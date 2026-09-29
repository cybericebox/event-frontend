"use client";

import {useQuery} from "@tanstack/react-query";
import {z} from "zod";
import {getManageContent, getManagePage, ManageApiError} from "@/api/manage";
import {usePrivateEvent} from "@/components/event/PrivateEventBootstrap";
import {EventPageContentSchema, type EventPageContent} from "@/types/eventContent";
import {ContentBlocks} from "./ContentBlocks";
import {EventLoading} from "../EventLoading";
import {requireApiOrigin} from "@/utils/origins";

async function getVisiblePage(eventID: string, slug: string): Promise<EventPageContent | null> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/content/pages/${encodeURIComponent(slug)}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new ManageApiError(response.status);
    const body: unknown = await response.json();
    return z.object({Data: EventPageContentSchema}).parse(body).Data;
}

export function ClientContentPage({slug, publicEventID}: {slug: string; publicEventID?: string}) {
    const privateEvent = usePrivateEvent();
    const eventID = publicEventID ?? privateEvent?.EventID;
    const page = useQuery({
        queryKey: ["event-client-page", eventID, slug],
        queryFn: async () => {
            const visible = await getVisiblePage(eventID!, slug);
            if (visible) return visible;
            // A manager-only page has no public response. Manager access is
            // checked again by the API; the site shows only the published
            // version at its published address, never a draft.
            const [managed, content] = await Promise.all([
                getManagePage(eventID!, slug), getManageContent(eventID!),
            ]);
            if (!managed.PublishedAt || managed.Slug !== slug) throw new ManageApiError(404);
            return {Page: managed, Variables: content.Variables};
        },
        enabled: !!eventID,
        retry: false,
    });
    if (!eventID || page.isPending) return <EventLoading event={privateEvent} label="Завантажуємо сторінку…" />;
    if (page.isError) {
        const missing = page.error instanceof ManageApiError && [403, 404].includes(page.error.status);
        return <div className="event-shell-state" role="alert">
            <h1>{missing ? "Сторінку не знайдено або доступ обмежено" : "Не вдалося завантажити сторінку"}</h1>
            {!missing && <button className="ib-btn" onClick={() => void page.refetch()}>Повторити</button>}
        </div>;
    }
    return <ContentBlocks document={page.data.Page.Document} variables={page.data.Variables} title={page.data.Page.Title} coverImage={privateEvent?.PreviewPicture} eventID={eventID} />;
}
