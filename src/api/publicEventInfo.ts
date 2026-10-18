import {cache} from "react";
import {headers} from "next/headers";
import {z} from "zod";
import {PublicEventInfoSchema, type PublicEventInfo} from "@/types/publicEventInfo";
import {apiHost} from "@/utils/origins";
import {getCommonManifest} from "./commonPage";
import {commonPageSlug} from "@/utils/commonPagePath";
import {fetchPublic} from "./publicFetch";
import {missingHosts} from "@/utils/server/missingHosts";

export type {PublicEventInfo} from "@/types/publicEventInfo";

export {SERVER_FETCH_TIMEOUT_MS} from "./publicFetch";

// Personal routes retain the anonymous identity read; common pages share a hard-expiring manifest.
export class PublicEventError extends Error {
    constructor(readonly status: number, readonly requestId?: string) {
        super(`Event info request failed: ${status}`);
    }
}

export const getPublicEventInfo = cache(async (): Promise<PublicEventInfo | null> => {
    const requestHeaders = await headers();
    if (commonPageSlug(requestHeaders.get("x-event-pathname") ?? "/") !== null) return (await getCommonManifest())?.Event ?? null;
    const host = requestHeaders.get("host");
    if (!host) return null;
    // A host the API just said it does not know costs it nothing more for a short while (anonymous: no grant is sent here).
    if (missingHosts.has(host)) return null;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response = await fetchPublic(`${internalOrigin ?? `https://${apiHost}`}/api/events/self/public-info`, {
        Accept: "application/json",
        Origin: `https://${host}`,
        ...(internalOrigin ? {Host: apiHost} : {}),
    });
    if (response.status === 404) {
        missingHosts.add(host);
        return null;
    }
    if (response.status < 200 || response.status >= 300) throw new PublicEventError(response.status, response.requestId);
    const envelope = z.object({Data: PublicEventInfoSchema}).safeParse(response.body);
    if (!envelope.success) throw new Error("Invalid public event info response");
    return envelope.data.Data;
});
