"use client";

import {useQuery} from "@tanstack/react-query";
import {EventLoadError} from "@/components/event/EventLoadError";
import {z} from "zod";
import {getManageContent, getManagePage, ManageApiError} from "@/api/manage";
import {usePrivateEvent} from "@/components/event/PrivateEventBootstrap";
import {EventPageContentSchema, type EventPageContent} from "@/types/eventContent";
import {ContentBlocks} from "./ContentBlocks";
import {EventLoading} from "../EventLoading";
import {NotFoundScreen} from "../NotFoundScreen";
import {requireApiOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";

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
    if (!eventID || page.isPending) return <EventLoading event={privateEvent} label={t("content.page.loading")} />;
    if (page.isError) {
        const missing = page.error instanceof ManageApiError && [403, 404].includes(page.error.status);
        if (!missing) return <EventLoadError message={t("content.page.failed")} error={page.error} onRetry={() => void page.refetch()} />;
        return <NotFoundScreen block title={t("content.page.missing")} />;
    }
    return <ContentBlocks document={page.data.Page.Document} variables={page.data.Variables} title={page.data.Page.Title} coverImage={privateEvent?.PreviewPicture} eventID={eventID} />;
}
