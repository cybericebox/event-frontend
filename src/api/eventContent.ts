import {plainTextRichText} from "@/components/event/content/richTextState";
import {headers} from "next/headers";
import {z} from "zod";
import {getPublicEventInfo} from "./publicEventInfo";
import {EventContentSchema, EventPageContentSchema, type EventContent, type EventPageContent} from "@/types/eventContent";
import {defaultMockLanding} from "./mockLanding";

export type {EventContent, EventPageContent} from "@/types/eventContent";

async function publicPageAvailable(slug: string): Promise<boolean> {
    const event = await getPublicEventInfo();
    if (!event) return false;
    const host = (await headers()).get("host");
    if (!host) return false;
    const apiHost = `api.${process.env.NEXT_PUBLIC_DOMAIN}`;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response = await fetch(`${internalOrigin ?? `https://${apiHost}`}/api/events/${event.EventID}/content/pages/${encodeURIComponent(slug)}/access`, {
        headers: {Origin: `https://${host}`, ...(internalOrigin ? {Host: apiHost} : {})},
        cache: "no-store",
    });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Event page access request failed: ${response.status}`);
    return true;
}

async function fetchContent(path: string, revalidate?: number): Promise<unknown | null> {
    const event = await getPublicEventInfo();
    if (!event) return null;
    const host = (await headers()).get("host");
    if (!host) return null;
    const apiHost = `api.${process.env.NEXT_PUBLIC_DOMAIN}`;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response = await fetch(`${internalOrigin ?? `https://${apiHost}`}/api/events/${event.EventID}/content${path}`, {
        headers: {
            Accept: "application/json",
            Origin: `https://${host}`,
            ...(internalOrigin ? {Host: apiHost} : {}),
        },
        // The uncached public-info check above protects unpublished tenants.
        ...(revalidate
            ? {next: {revalidate, tags: [`event-content:${event.EventID}`]}}
            : {cache: "no-store" as const}),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Event content request failed: ${response.status}`);
    const envelope = z.object({Data: z.unknown()}).parse(await response.json());
    return envelope.Data;
}

export async function getLandingContent(): Promise<EventContent | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return {Landing: defaultMockLanding, Variables: {"event.name": "Winter Arena CTF", "event.finishAt": new Date(Date.now() + 18 * 3_600_000).toISOString()}};
    }
    const [document, values] = await Promise.all([
        fetchContent("/document", 300),
        fetchContent("/values", 60),
    ]);
    if (document === null || values === null) return null;
    return EventContentSchema.parse({...z.object({Landing: z.unknown()}).parse(document), ...z.object({Variables: z.unknown()}).parse(values)});
}

export async function getEventPageContent(slug: string): Promise<EventPageContent | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return {Page: {Slug: slug, Title: slug === "faq" ? "Питання та відповіді" : "Інформація", Document: {blocks: [
            {id: "sample", type: "text", richText: plainTextRichText("Вміст цієї сторінки налаштовується організаторами події.")},
        ]}}, Variables: {}};
    }
    if (!await publicPageAvailable(slug)) return null;
    const path = `/pages/${encodeURIComponent(slug)}`;
    const [document, values] = await Promise.all([
        fetchContent(`${path}/document`, 300),
        fetchContent(`${path}/values`, 60),
    ]);
    if (document === null || values === null) return null;
    return EventPageContentSchema.parse({...z.object({Page: z.unknown()}).parse(document), ...z.object({Variables: z.unknown()}).parse(values)});
}
