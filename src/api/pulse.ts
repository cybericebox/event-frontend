import {z} from "zod";
import {requireApiOrigin} from "@/utils/origins";

// The cheap per-tab call every site makes (backend: GET /api/notifications/pulse).
// Banners is the version of the banner list; Inbox is null for a guest.
// No cache option: the answer carries an ETag and the browser revalidates it (304).
const pulseSchema = z.object({Data: z.object({
    Banners: z.string(),
    Inbox: z.object({Cursor: z.string(), Unread: z.number()}).nullable().catch(null),
})});

export type Pulse = z.infer<typeof pulseSchema>["Data"];

/** The Banners version of an empty list (the first 16 hex of sha256 of nothing); a newer backend may send "". */
export const EMPTY_BANNERS_VERSION = "e3b0c44298fc1c14";

/** Whether a pulse Banners version stands for a non-empty list: only then is the list worth a request. */
export function hasBanners(version: string): boolean {
    return version !== "" && version !== EMPTY_BANNERS_VERSION;
}

export async function getPulse(eventID: string): Promise<Pulse> {
    const query = new URLSearchParams({site: "event"});
    if (eventID) query.set("event", eventID);
    const response = await fetch(`${requireApiOrigin()}/api/notifications/pulse?${query}`, {
        credentials: "include", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new Error(`Pulse request failed: ${response.status}`);
    return pulseSchema.parse(await response.json()).Data;
}
