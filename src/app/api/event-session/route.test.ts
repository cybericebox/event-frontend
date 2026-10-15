import {generateKeyPairSync,createHash,sign} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({get:vi.fn(),set:vi.fn(),key:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mocks.get,set:mocks.set})}));
vi.mock("@/api/commonPage",()=>({getRenderKey:mocks.key}));
import {POST} from "./route";
import {READ_COOKIE,ATTEMPT_COOKIE} from "@/utils/server/eventRenderGrant";
const pair=generateKeyPairSync("ed25519");
const nonce="a".repeat(43);
function signed(challenge:string) {
    const now=Math.floor(Date.now()/1000);
    const payload={iss:"cybericebox:event-render",aud:"https://one.example.test",scope:"common-pages",sub:"11111111-1111-4111-8111-111111111111",sid:"22222222-2222-4222-8222-222222222222",event_id:"33333333-3333-4333-8333-333333333333",preview:true,challenge,iat:now,exp:now+60};
    const raw=[{alg:"EdDSA",typ:"cib-event-render+jwt",kid:"key1"},payload].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
    return raw+"."+sign(null,Buffer.from(raw),pair.privateKey).toString("base64url");
}
function request(token:string,origin="https://one.example.test") {return new Request("https://one.example.test/api/event-session",{method:"POST",headers:{Host:"one.example.test",Origin:origin,"Content-Type":"application/json","x-cib-event-session":"1"},body:JSON.stringify({Token:token})});}
beforeEach(()=>{vi.clearAllMocks();mocks.get.mockImplementation((key:string)=>key===ATTEMPT_COOKIE ? {value:nonce}:undefined);mocks.key.mockResolvedValue({KeyID:"key1",PublicKey:pair.publicKey.export({format:"jwk"}).x});});
describe("read cookie installation",()=>{
    it("binds the installation to this browser and sets only host-only secure cookies",async()=>{
        const response=await POST(request(signed(createHash("sha256").update(nonce).digest("base64url"))));
        expect(response.status).toBe(200);
        const options=mocks.set.mock.calls.find(c=>c[0]===READ_COOKIE)?.[2];
        expect(options).toMatchObject({secure:true,httpOnly:true,sameSite:"strict",path:"/"});
        expect(options.domain).toBeUndefined();expect(options.maxAge).toBeLessThanOrEqual(60);
    });
    it("rejects cross-browser challenge swap and sibling-origin CSRF",async()=>{
        expect((await POST(request(signed("b".repeat(43))))).status).toBe(404);
        expect((await POST(request(signed("a".repeat(43)),"https://evil.example.test"))).status).toBe(404);
        expect(mocks.set).not.toHaveBeenCalled();
    });
});
