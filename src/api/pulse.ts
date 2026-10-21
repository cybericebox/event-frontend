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

export async function getPulse(eventID: string): Promise<Pulse> {
    const query = new URLSearchParams({site: "event"});
    if (eventID) query.set("event", eventID);
    const response = await fetch(`${requireApiOrigin()}/api/notifications/pulse?${query}`, {
        credentials: "include", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new Error(`Pulse request failed: ${response.status}`);
    return pulseSchema.parse(await response.json()).Data;
}
