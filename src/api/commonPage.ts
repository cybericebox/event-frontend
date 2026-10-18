import {cache} from "react";
import {cookies,headers} from "next/headers";
import {READ_COOKIE,eventOriginFromHost,verifyRenderGrant} from "@/utils/server/eventRenderGrant";
import {missingHosts} from "@/utils/server/missingHosts";
import {CommonPageStore,type ReadContext} from "./commonPageStore";
import {getRenderKey,renderApi} from "./renderKey";

export {RenderReadError} from "./commonPageStore";
export {getRenderKey,renderApi};
export async function readContext():Promise<ReadContext|null> {
    const origin=eventOriginFromHost((await headers()).get("host"));
    if (!origin) return null;
    const tag=new URL(origin).hostname.split(".")[0];
    const token=(await cookies()).get(READ_COOKIE)?.value;
    if (!token) return {origin,tag,claims:null};
    const claims=verifyRenderGrant(token,await getRenderKey(token),origin);
    return claims ? {origin,tag,token,claims}:{origin,tag,claims:null};
}
const store=new CommonPageStore(renderApi,Date.now,missingHosts);
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
