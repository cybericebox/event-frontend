import {headers} from "next/headers";
import {z} from "zod";
import {getPublicEventInfo} from "./publicEventInfo";
import {fetchPublic} from "./publicFetch";
import {EventContentSchema, EventPageContentSchema, type EventContent, type EventPageContent} from "@/types/eventContent";
import {apiHost} from "@/utils/origins";

export type {EventContent, EventPageContent} from "@/types/eventContent";

async function publicPageAvailable(slug: string): Promise<boolean> {
    const event = await getPublicEventInfo();
    if (!event) return false;
    const host = (await headers()).get("host");
    if (!host) return false;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response = await fetchPublic(`${internalOrigin ?? `https://${apiHost}`}/api/events/${event.EventID}/content/pages/${encodeURIComponent(slug)}/access`, {
        Origin: `https://${host}`, ...(internalOrigin ? {Host: apiHost} : {}),
    });
    if (response.status === 404) return false;
    if (response.status < 200 || response.status >= 300) throw new Error(`Event page access request failed: ${response.status}`);
    return true;
}

async function fetchContent(path: string): Promise<unknown | null> {
    const event = await getPublicEventInfo();
    if (!event) return null;
    const host = (await headers()).get("host");
    if (!host) return null;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    // Every public read is cached for 30 s on this replica: the document and the values alike.
    const response = await fetchPublic(`${internalOrigin ?? `https://${apiHost}`}/api/events/${event.EventID}/content${path}`, {
        Accept: "application/json",
        Origin: `https://${host}`,
        ...(internalOrigin ? {Host: apiHost} : {}),
    });
    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) throw new Error(`Event content request failed: ${response.status}`);
    const envelope = z.object({Data: z.unknown()}).parse(response.body);
    return envelope.Data;
}

export async function getLandingContent(): Promise<EventContent | null> {
    const [document, values] = await Promise.all([
        fetchContent("/document"),
        fetchContent("/values"),
    ]);
    if (document === null || values === null) return null;
    return EventContentSchema.parse({...z.object({Landing: z.unknown()}).parse(document), ...z.object({Variables: z.unknown()}).parse(values)});
}

export async function getEventPageContent(slug: string): Promise<EventPageContent | null> {
    if (!await publicPageAvailable(slug)) return null;
    const path = `/pages/${encodeURIComponent(slug)}`;
    const [document, values] = await Promise.all([
        fetchContent(`${path}/document`),
        fetchContent(`${path}/values`),
    ]);
    if (document === null || values === null) return null;
    return EventPageContentSchema.parse({...z.object({Page: z.unknown()}).parse(document), ...z.object({Variables: z.unknown()}).parse(values)});
}
