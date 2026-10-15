import {randomBytes,createHash} from "node:crypto";
import {cookies} from "next/headers";
import {ATTEMPT_COOKIE,cookieOptions,validSessionRequest} from "@/utils/server/eventRenderGrant";
export async function POST(request:Request) {
    if (!validSessionRequest(request)) return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
    const nonce=randomBytes(32).toString("base64url");
    (await cookies()).set(ATTEMPT_COOKIE,nonce,{...cookieOptions,maxAge:120});
    return Response.json({Challenge:createHash("sha256").update(nonce).digest("base64url")},{headers:{"Cache-Control":"no-store"}});
}
