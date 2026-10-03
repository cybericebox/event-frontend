import {cache} from "react";
import {headers} from "next/headers";
import {z} from "zod";
import {PublicEventInfoSchema, type PublicEventInfo} from "@/types/publicEventInfo";
import {apiHost} from "@/utils/origins";
import {fetchPublic} from "./publicFetch";

export type {PublicEventInfo} from "@/types/publicEventInfo";

export {SERVER_FETCH_TIMEOUT_MS} from "./publicFetch";

// The server fetch uses the incoming event host as Origin because the API
// resolves its event tenant from that header. It can read public events only:
// the host-only API session cookie is never sent to the event frontend server.
// React cache deduplicates the metadata and layout reads within one render; across renders the read comes from
// the 30 s stale-while-revalidate fetch cache, one fetch per replica at a time (publicFetch.ts).
export const getPublicEventInfo = cache(async (): Promise<PublicEventInfo | null> => {
    const host = (await headers()).get("host");
    if (!host) return null;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response = await fetchPublic(`${internalOrigin ?? `https://${apiHost}`}/api/events/self/public-info`, {
        Accept: "application/json",
        Origin: `https://${host}`,
        ...(internalOrigin ? {Host: apiHost} : {}),
    });
    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) throw new Error(`Event info request failed: ${response.status}`);
    const envelope = z.object({Data: PublicEventInfoSchema}).safeParse(response.body);
    if (!envelope.success) throw new Error("Invalid public event info response");
    return envelope.data.Data;
});
