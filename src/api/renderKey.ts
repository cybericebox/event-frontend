import {z} from "zod";
import {apiHost} from "@/utils/origins";
import {RenderKeySchema} from "@/utils/server/eventRenderGrant";
import {HardCache} from "@/utils/server/commonPageCache";
import {RenderReadError} from "./commonPageStore";
import {SERVER_FETCH_TIMEOUT_MS} from "./publicFetch";
import {serverGet} from "./serverGet";

// The render API client and the signing key it serves. Free of next/headers, so the proxy can verify a grant too.
/** The secret that opens /api/render/* to this server. Server-only: never exposed to the browser (no NEXT_PUBLIC_ prefix). */
function renderSecret() {
    const secret=process.env.RENDER_SECRET;
    if (!secret) throw new Error("RENDER_SECRET is required");
    return secret;
}
export async function renderApi(path:string,context:{token?:string}) {
    const internal=process.env.INTERNAL_API_ORIGIN;
    const base=internal ?? `https://${apiHost}`;
    const url=`${base}${path}`;
    // The secret goes only to the configured API origin, and a redirect is never followed with it.
    if (new URL(url).origin!==new URL(base).origin || !path.startsWith("/api/render/")) throw new Error("Render secret refused for a foreign URL");
    const response=await serverGet(url,
        {Accept:"application/json","X-Render-Secret":renderSecret(),...(internal ? {Host:apiHost}:{}),...(context.token ? {Authorization:`EventRender ${context.token}`}:{})},
        AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),true);
    if (response.status>=300 && response.status<400) {
        response.body?.cancel().catch(()=>undefined);
        return {status:502,body:null};
    }
    if (!response.ok) return {status:response.status,body:null,requestId:response.headers.get("X-Request-ID") ?? undefined};
    return {status:response.status,body:await response.json() as unknown};
}
const keys=new HardCache<z.infer<typeof RenderKeySchema>>({maxEntries:1,maxBytes:1024,ttl:60_000,maxInflight:1});
// One fixed refresh slot bounds unknown-kid traffic and coalesces concurrent rotation misses.
let nextKeyRefreshAt=0;
let keyRefresh:Promise<z.infer<typeof RenderKeySchema>>|undefined;
async function loadRenderKey() {
    const response=await renderApi("/api/render/key",{});
    if (response.status!==200) throw new RenderReadError(response.status,response.requestId);
    return {value:z.object({Data:RenderKeySchema}).parse(response.body).Data};
}
export async function getRenderKey(token?:string) {
    const key=await keys.get("api",loadRenderKey);
    // Inspect only a bounded, purpose-specific header. It never grants access: every caller verifies the signature and claims.
    if (!token || token.length>8192) return key;
    const parts=token.split(".");
    if (parts.length!==3 || parts[0].length>1024 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) return key;
    try {
        const header=z.object({alg:z.literal("EdDSA"),typ:z.literal("cib-event-render+jwt"),kid:z.string().min(1).max(128)}).strict().parse(JSON.parse(Buffer.from(parts[0],"base64url").toString()));
        if (header.kid===key.KeyID) return key;
    } catch {return key;}
    if (keyRefresh) return keyRefresh;
    if (Date.now()<nextKeyRefreshAt) return key;
    nextKeyRefreshAt=Date.now()+5000;
    keyRefresh=loadRenderKey().then(async({value})=>{
        keys.delete("api");
        return keys.get("api",async()=>({value}));
    }).finally(()=>{keyRefresh=undefined;});
    return keyRefresh;
}
