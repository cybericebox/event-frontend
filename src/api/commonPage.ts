import {cache} from "react";
import {cookies,headers} from "next/headers";
import {z} from "zod";
import {apiHost} from "@/utils/origins";
import {READ_COOKIE,RenderKeySchema,eventOriginFromHost,verifyRenderGrant} from "@/utils/server/eventRenderGrant";
import {HardCache} from "@/utils/server/commonPageCache";
import {CommonPageStore,RenderReadError,type ReadContext} from "./commonPageStore";
import {SERVER_FETCH_TIMEOUT_MS} from "./publicFetch";

export {RenderReadError} from "./commonPageStore";
export async function renderApi(path:string,context:{origin:string;token?:string}) {
    const internal=process.env.INTERNAL_API_ORIGIN;
    const response=await fetch(`${internal ?? `https://${apiHost}`}${path}`,{
        cache:"no-store",signal:AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
        headers:{Accept:"application/json",Origin:context.origin,...(internal ? {Host:apiHost}:{}),...(context.token ? {Authorization:`EventRender ${context.token}`}:{})},
    });
    if (!response.ok) return {status:response.status,body:null,requestId:response.headers.get("X-Request-ID") ?? undefined};
    return {status:response.status,body:await response.json() as unknown};
}
const keys=new HardCache<z.infer<typeof RenderKeySchema>>({maxEntries:1,maxBytes:1024,ttl:60_000,maxInflight:1});
export function getRenderKey() {
    return keys.get("api",async () => {
        const response=await renderApi("/api/auth/event-render-key",{origin:`https://${apiHost}`});
        if (response.status!==200) throw new RenderReadError(response.status,response.requestId);
        return {value:z.object({Data:RenderKeySchema}).parse(response.body).Data};
    });
}
export async function readContext():Promise<ReadContext|null> {
    const origin=eventOriginFromHost((await headers()).get("host"));
    if (!origin) return null;
    const token=(await cookies()).get(READ_COOKIE)?.value;
    if (!token) return {origin,claims:null};
    const claims=verifyRenderGrant(token,await getRenderKey(),origin);
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
