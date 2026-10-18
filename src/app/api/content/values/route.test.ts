import {generateKeyPairSync, sign} from "node:crypto";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {MISSING_HOST_TTL_MS} from "@/utils/server/missingHosts";
const browser = vi.hoisted(() => ({host:"one.example.test",token:""}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({host:browser.host}),cookies:async()=>({get:()=>browser.token ? {value:browser.token}:undefined})}));
const event = {EventID:"33333333-3333-4333-8333-333333333333",Tag:"one",Name:"Published",StartTime:"2026-10-15T12:00:00Z",FinishTime:null,Status:1,Participation:null,Registration:0,CanViewResults:false,CanViewParticipants:false,PreviewDescription:"",PreviewPicture:"",Theme:{Version:1,Brand:"#112233",Accent:"#112233",AccentLight:"#112233",AccentDark:"#112233",AccentLive:"#112233"}};
const pair = generateKeyPairSync("ed25519");
function staffToken() {
    const claims={iss:"cybericebox:event-render",aud:`https://${browser.host}`,scope:"common-pages",sub:"11111111-1111-4111-8111-111111111111",sid:"22222222-2222-4222-8222-222222222222",event_id:event.EventID,preview:true,challenge:"a".repeat(43),iat:120,exp:180};
    const raw=[{alg:"EdDSA",typ:"cib-event-render+jwt",kid:"test"},claims].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
    return `${raw}.${sign(null,Buffer.from(raw),pair.privateKey).toString("base64url")}`;
}
let revision:string,count:number,gateStatus:number,valueStatus:number,contentReads:number;
let beforeValue:undefined|(()=>Promise<void>);
let GET:typeof import("./route").GET;
beforeEach(async()=>{
    vi.resetModules();vi.useFakeTimers();vi.setSystemTime(120_000);vi.stubEnv("RENDER_SECRET","values-test-render-secret-0123456789ab");
    browser.host="one.example.test";browser.token="";revision="r1";count=1;gateStatus=200;valueStatus=200;contentReads=0;beforeValue=undefined;
    vi.stubGlobal("fetch",vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
        const url=new URL(String(input));
        const headers=new Headers(init?.headers);
        expect(init?.cache).toBe("no-store");expect(headers.has("Cookie")).toBe(false);expect(headers.get("X-Render-Secret")).toBe("values-test-render-secret-0123456789ab");expect(headers.has("Origin")).toBe(false);
        if(url.pathname==="/api/render/key")return Response.json({Data:{KeyID:"test",PublicKey:pair.publicKey.export({format:"jwk"}).x}});
        const slug=url.searchParams.get("page")??"";
        const currentEvent={...event,Tag:browser.host.split(".")[0]};
        if(url.pathname.endsWith("/manifest"))return gateStatus===200 ? Response.json({Data:{Event:currentEvent,Revision:revision,Audience:headers.has("Authorization")?"staff":"public",Page:{Slug:slug,Title:"Landing"},CacheUntil:Date.now()+1000}}):new Response(null,{status:gateStatus});
        contentReads++;
        const snapshotRevision=revision,snapshotCount=count;
        await beforeValue?.();
        if(valueStatus!==200)return new Response(null,{status:valueStatus});
        if(url.pathname.endsWith("/page")) {
            if(url.searchParams.get("revision")!==snapshotRevision)return new Response(null,{status:409});
            return Response.json({Data:{Event:currentEvent,Revision:snapshotRevision,Page:{Slug:slug,Title:"Landing",Document:{blocks:[]}},Variables:{teams:snapshotCount}}});
        }
        return Response.json({Data:{Variables:{teams:count}}});
    }));
    GET=(await import("./route")).GET;
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
const read=(eventId=event.EventID,page="")=>GET(new Request(`https://${browser.host}/api/content/values?eventId=${eventId}${page ? `&page=${page}`:""}`,{headers:{host:browser.host}}));

it("shares staggered and concurrent public reads for 30 seconds, then refreshes values",async()=>{
    for(let i=0;i<5;i++)expect(await (await read()).json()).toEqual({Revision:revision,Variables:{teams:1}});
    expect(contentReads).toBe(1);
    count=2;vi.setSystemTime(150_001);
    const readers=await Promise.all(Array.from({length:20},()=>read()));
    for(const response of readers)expect(await response.json()).toEqual({Revision:revision,Variables:{teams:2}});
    expect(contentReads).toBe(2);
});
it("refreshes staff values independently of the five-minute document bundle",async()=>{
    browser.token=staffToken();
    const {getCommonPage}=await import("@/api/commonPage");
    expect((await getCommonPage())?.Variables).toEqual({teams:1});
    expect(await (await read()).json()).toEqual({Revision:revision,Variables:{teams:1}});
    count=7;vi.setSystemTime(151_000);
    expect(await (await read()).json()).toEqual({Revision:revision,Variables:{teams:7}});
    expect((await getCommonPage())?.Variables).toEqual({teams:1});
});
it("uses a new revision immediately and separates page, host and audience values",async()=>{
    await read();count=2;revision="r2";vi.setSystemTime(121_001);
    expect(await (await read()).json()).toEqual({Revision:revision,Variables:{teams:2}});
    count=3;expect(await (await read(event.EventID,"rules")).json()).toEqual({Revision:revision,Variables:{teams:3}});
    count=4;browser.host="two.example.test";expect(await (await read()).json()).toEqual({Revision:revision,Variables:{teams:4}});
    count=5;browser.token=staffToken();expect(await (await read()).json()).toEqual({Revision:revision,Variables:{teams:5}});
    expect(contentReads).toBe(5);
    expect((await read("44444444-4444-4444-8444-444444444444")).status).toBe(404);
    expect(contentReads).toBe(5);
});
it.each([404,503])("rejects warm values after expired visibility gate returns %s",async status=>{
    await read();vi.setSystemTime(121_001);gateStatus=status;
    if(status===404)expect((await read()).status).toBe(404);
    else expect((await read()).status).toBe(502);
    expect(contentReads).toBe(1);
    gateStatus=200;vi.setSystemTime(122_002);
    // A 404 for the landing marks the host unknown for a while; it is asked again after that.
    if(status===404)expect((await read()).status).toBe(404);
    vi.setSystemTime(122_002+MISSING_HOST_TTL_MS);
    expect((await read()).status).toBe(200);
});
it("does not cache failed value loads",async()=>{
    valueStatus=503;expect((await read()).status).toBe(502);
    valueStatus=200;expect(await (await read()).json()).toEqual({Revision:revision,Variables:{teams:1}});
    expect(contentReads).toBe(2);
});
it.each(["withdrawal","outage","revision","expiry"])("rechecks a slow value fill after %s",async change=>{
    if(change==="expiry")browser.token=staffToken();
    let release!:()=>void;
    beforeValue=()=>new Promise<void>(resolve=>{release=resolve;});
    const pending=read();
    await vi.waitFor(()=>expect(contentReads).toBe(1));
    vi.setSystemTime(change==="expiry"?180_001:122_001);
    if(change==="withdrawal")gateStatus=404;
    if(change==="outage")gateStatus=503;
    if(change==="revision"){revision="r2";count=8;}
    beforeValue=undefined;release();
    if(change==="outage")expect((await pending).status).toBe(502);
    else if(change==="revision")expect(await (await pending).json()).toEqual({Revision:revision,Variables:{teams:8}});
    else expect((await pending).status).toBe(404);
});
