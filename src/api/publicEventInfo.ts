import {cache} from "react";
import {headers} from "next/headers";
import {z} from "zod";
import {PublicEventInfoSchema, type PublicEventInfo} from "@/types/publicEventInfo";
import {apiHost} from "@/utils/origins";

export type {PublicEventInfo} from "@/types/publicEventInfo";

// A server render waits on these reads; a hung API must end in the error or outage
// state instead of streaming the route loader forever.
export const SERVER_FETCH_TIMEOUT_MS = 10_000;

// The server fetch uses the incoming event host as Origin because the API
// resolves its event tenant from that header. It can read public events only:
// the host-only API session cookie is never sent to the event frontend server.
// React cache deduplicates the metadata and layout reads within one render.
export const getPublicEventInfo = cache(async (): Promise<PublicEventInfo | null> => {
    const host = (await headers()).get("host");
    if (!host) return null;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response = await fetch(`${internalOrigin ?? `https://${apiHost}`}/api/events/self/public-info`, {
        headers: {
            Accept: "application/json",
            Origin: `https://${host}`,
            ...(internalOrigin ? {Host: apiHost} : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Event info request failed: ${response.status}`);
    const body: unknown = await response.json();
    const envelope = z.object({Data: PublicEventInfoSchema}).safeParse(body);
    if (!envelope.success) throw new Error("Invalid public event info response");
    return envelope.data.Data;
});
