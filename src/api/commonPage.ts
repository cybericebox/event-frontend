import {cache} from "react";
import {cookies,headers} from "next/headers";
import {z} from "zod";
import {apiHost} from "@/utils/origins";
import {READ_COOKIE,RenderKeySchema,eventOriginFromHost,verifyRenderGrant} from "@/utils/server/eventRenderGrant";
import {HardCache} from "@/utils/server/commonPageCache";
import {CommonPageStore,RenderReadError,type ReadContext} from "./commonPageStore";
import {SERVER_FETCH_TIMEOUT_MS} from "./publicFetch";
import {serverGet} from "./serverGet";

export {RenderReadError} from "./commonPageStore";
export async function renderApi(path:string,context:{origin:string;token?:string}) {
    const internal=process.env.INTERNAL_API_ORIGIN;
    const response=await serverGet(`${internal ?? `https://${apiHost}`}${path}`,
        {Accept:"application/json",Origin:context.origin,...(internal ? {Host:apiHost}:{}),...(context.token ? {Authorization:`EventRender ${context.token}`}:{})},
        AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS));
    if (!response.ok) return {status:response.status,body:null,requestId:response.headers.get("X-Request-ID") ?? undefined};
    return {status:response.status,body:await response.json() as unknown};
}
const keys=new HardCache<z.infer<typeof RenderKeySchema>>({maxEntries:1,maxBytes:1024,ttl:60_000,maxInflight:1});
// One fixed refresh slot bounds unknown-kid traffic and coalesces concurrent rotation misses.
let nextKeyRefreshAt=0;
let keyRefresh:Promise<z.infer<typeof RenderKeySchema>>|undefined;
async function loadRenderKey() {
    const response=await renderApi("/api/auth/event-render-key",{origin:`https://${apiHost}`});
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
export async function readContext():Promise<ReadContext|null> {
    const origin=eventOriginFromHost((await headers()).get("host"));
    if (!origin) return null;
    const token=(await cookies()).get(READ_COOKIE)?.value;
    if (!token) return {origin,claims:null};
    const claims=verifyRenderGrant(token,await getRenderKey(token),origin);
    return claims ? {origin,token,claims}:{origin,claims:null};
}
const store=new CommonPageStore(renderApi);
export const getCommonManifest=cache(async (slug="") => {
    const context=await readContext();
    return context ? store.manifest(context,slug):null;
});
export const getCommonPage=cache(async (slug="") => {
    const context=await readContext();
    return context ? store.page(context,slug):null;
});

export const getCommonValues=cache(async (slug:string,eventID:string) => {
    const context=await readContext();
    return context ? store.values(context,slug,eventID):null;
});
