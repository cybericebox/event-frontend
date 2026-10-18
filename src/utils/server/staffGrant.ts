import {getRenderKey} from "@/api/renderKey";
import {READ_COOKIE, eventOriginFromHost, verifyRenderGrant} from "./eventRenderGrant";

export {READ_COOKIE};

/**
 * True when the cookie holds a staff preview grant that is signed by the API, unexpired and issued for this
 * very host. It decides only the HTTP status of a hidden event's page (200 for its staff instead of the 404 an
 * anonymous visitor gets); the page body still needs the same grant, re-checked on every render.
 */
export async function hasStaffGrant(host: string | null, token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const origin = eventOriginFromHost(host);
    if (!origin) return false;
    try {
        return verifyRenderGrant(token, await getRenderKey(token), origin)?.preview === true;
    } catch {
        // key unreachable: the status stays the anonymous one
        return false;
    }
}
