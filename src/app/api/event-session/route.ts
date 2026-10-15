import {createHash,timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {z} from "zod";
import {getRenderKey} from "@/api/commonPage";
import {READ_COOKIE,ATTEMPT_COOKIE,cookieOptions,eventOriginFromHost,validSessionRequest,verifyRenderGrant} from "@/utils/server/eventRenderGrant";
const noStore={"Cache-Control":"no-store"};
const denied=()=>new Response(null,{status:404,headers:noStore});
export async function POST(request:Request) {
    if (!validSessionRequest(request)) return denied();
    const reader=request.body?.getReader();
    if (!reader) return denied();
    let bytes=0;
    const chunks:Uint8Array[]=[];
    for (;;) {
        const {done,value}=await reader.read();
        if (done) break;
        bytes+=value.byteLength;
        if (bytes>9000) {await reader.cancel();return denied();}
        chunks.push(value);
    }
    const body=Buffer.concat(chunks).toString("utf8");
    let token:string;
    try {token=z.object({Token:z.string().max(8192)}).parse(JSON.parse(body)).Token;} catch {return denied();}
    const store=await cookies();
    const nonce=store.get(ATTEMPT_COOKIE)?.value;
    if (!nonce || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) return denied();
    const claims=verifyRenderGrant(token,await getRenderKey(token),eventOriginFromHost(request.headers.get("host"))!);
    if (!claims) return denied();
    const expected=createHash("sha256").update(nonce).digest("base64url");
    if (!timingSafeEqual(Buffer.from(expected),Buffer.from(claims.challenge))) return denied();
    store.set(ATTEMPT_COOKIE,"",{...cookieOptions,maxAge:0});
    store.set(READ_COOKIE,token,{...cookieOptions,maxAge:Math.max(0,claims.exp-Math.floor(Date.now()/1000))});
    return Response.json({Subject:claims.sub,ExpiresAt:claims.exp},{headers:noStore});
}
export async function DELETE(request:Request) {
    if (!validSessionRequest(request)) return denied();
    const store=await cookies();
    for (const name of [READ_COOKIE,ATTEMPT_COOKIE]) store.set(name,"",{...cookieOptions,maxAge:0});
    return new Response(null,{status:204,headers:noStore});
}
