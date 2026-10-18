import {generateKeyPairSync,sign} from "node:crypto";
import {afterEach,expect,it,vi} from "vitest";
const cookie=vi.hoisted(()=>({token:""}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({host:"one.example.test"}),cookies:async()=>({get:()=>({value:cookie.token})})}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();cookie.token="";});
it("refreshes an unknown rotated signing key once, coalesces attackers, and still verifies every grant",async()=>{
    vi.resetModules();vi.useFakeTimers();vi.setSystemTime(120_000);vi.stubEnv("RENDER_SECRET","rotation-test-render-secret-0123456789ab");
    const first=generateKeyPairSync("ed25519"),second=generateKeyPairSync("ed25519");
    const oldKey={KeyID:"old",PublicKey:first.publicKey.export({format:"jwk"}).x};
    const newKey={KeyID:"new",PublicKey:second.publicKey.export({format:"jwk"}).x};
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({Data:oldKey})).mockImplementation(async()=>Response.json({Data:newKey}));vi.stubGlobal("fetch",fetcher);
    const {getRenderKey,readContext}=await import("./commonPage");
    await getRenderKey();
    expect(String(fetcher.mock.calls[0][0])).toContain("/api/render/key");
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({"X-Render-Secret":"rotation-test-render-secret-0123456789ab"});
    expect(fetcher.mock.calls[0][1].headers.Origin).toBeUndefined();
    const token=(kid:string,aud="https://one.example.test")=>{
        const payload={iss:"cybericebox:event-render",aud,scope:"common-pages",sub:"11111111-1111-4111-8111-111111111111",sid:"22222222-2222-4222-8222-222222222222",event_id:"33333333-3333-4333-8333-333333333333",preview:true,challenge:"a".repeat(43),iat:120,exp:180};
        const raw=[{alg:"EdDSA",typ:"cib-event-render+jwt",kid},payload].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
        return raw+"."+sign(null,Buffer.from(raw),second.privateKey).toString("base64url");
    };
    cookie.token=token("new");
    const readers=await Promise.all(Array.from({length:20},()=>readContext()));
    expect(readers.every(reader=>reader?.claims?.event_id==="33333333-3333-4333-8333-333333333333")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for(let i=0;i<20;i++){cookie.token=token(`unknown-${i}`);expect((await readContext())?.claims).toBeNull();}
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5001);cookie.token=token("still-unknown");
    expect((await readContext())?.claims).toBeNull();expect(fetcher).toHaveBeenCalledTimes(3);
    cookie.token=token("new","https://two.example.test");expect((await readContext())?.claims).toBeNull();
    cookie.token="a".repeat(8193);expect((await readContext())?.claims).toBeNull();expect(fetcher).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5001);fetcher.mockRejectedValue(new TypeError("key endpoint down"));cookie.token=token("untrusted");
    await Promise.allSettled([readContext()]);
    await Promise.allSettled(Array.from({length:20},()=>readContext()));
    expect(fetcher).toHaveBeenCalledTimes(4);
});
