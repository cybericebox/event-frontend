import {headers} from "next/headers";
import {z} from "zod";
import {getPublicEventInfo} from "./publicEventInfo";
import {EventContentSchema, EventPageContentSchema, type EventContent, type EventPageContent} from "@/types/eventContent";
import {defaultLiveLayout, liveLayoutSchema, type LiveLayout} from "./manageLive";

export type {EventContent, EventPageContent} from "@/types/eventContent";

async function fetchContent(path: string, cacheLanding = false): Promise<unknown | null> {
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
        // The server reaches this fetch only after an uncached public-info
        // check. Unpublished/withdrawn tenants return 404 before any landing
        // content is cached. Keep per-event content fresh within one minute.
        ...(cacheLanding
            ? {next: {revalidate: 60, tags: [`event-landing:${event.EventID}`]}}
            : {cache: "no-store" as const}),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Event content request failed: ${response.status}`);
    const envelope = z.object({Data: z.unknown()}).parse(await response.json());
    return envelope.Data;
}

export async function getLandingContent(): Promise<EventContent | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return {Landing: {blocks: [
            {id: "intro", type: "section", label: "Про подію"},
            {id: "description", type: "text", markdown: "Командне змагання з кібербезпеки на CyberICEBox. Розв'язуйте завдання, співпрацюйте з командою та стежте за результатами."},
        ]}, Variables: {"event.name": "Winter Arena CTF"}};
    }
    const data = await fetchContent("", true);
    return data === null ? null : EventContentSchema.parse(data);
}

export async function getLiveContent(): Promise<LiveLayout | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return defaultLiveLayout;
    const data = await fetchContent("");
    return data === null ? null : liveLayoutSchema.parse(z.object({Live: z.unknown()}).parse(data).Live);
}

export async function getEventPageContent(slug: string): Promise<EventPageContent | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return {Page: {Slug: slug, Title: slug === "faq" ? "Питання та відповіді" : "Інформація", Document: {blocks: [
            {id: "sample", type: "text", markdown: "Вміст цієї сторінки налаштовується організаторами події."},
        ]}}, Variables: {}};
    }
    const data = await fetchContent(`/pages/${encodeURIComponent(slug)}`);
    return data === null ? null : EventPageContentSchema.parse(data);
}
