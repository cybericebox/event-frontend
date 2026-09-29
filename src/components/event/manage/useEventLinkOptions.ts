"use client";

import {createContext, useContext} from "react";
import {useQuery} from "@tanstack/react-query";
import {getManageContent, getManagePages} from "@/api/manage";
import type {ContentDocument, ContentValue} from "@/types/eventContent";
import {eventOrigin, idOrigin} from "@/utils/origins";

// The document being edited: its anchors link as "#anchor" (they may not be
// saved yet). `landing` tells the picker that "/#anchor" is this document.
export const EditedDocumentContext = createContext<{document: ContentDocument; landing: boolean} | null>(null);

export function documentAnchors(document: ContentDocument): {anchor: string; label: string}[] {
    return document.blocks.flatMap(block => {
        const anchor = block.anchor?.trim();
        if (!anchor) return [];
        const title = block.type === "section" ? block.label : block.title;
        return [{anchor, label: title?.trim() ? `${title.trim()} (#${anchor})` : `#${anchor}`}];
    });
}

export function useEventLinkOptions(eventID: string, values: Record<string, ContentValue>) {
    const edited = useContext(EditedDocumentContext);
    const pages = useQuery({
        queryKey: ["event-management-pages", eventID],
        queryFn: () => getManagePages(eventID),
        retry: false,
        refetchOnWindowFocus: false,
    });
    const content = useQuery({
        queryKey: ["event-management-content", eventID],
        queryFn: () => getManageContent(eventID),
        retry: false,
        refetchOnWindowFocus: false,
        enabled: !edited?.landing,
    });
    const tag = values["event.tag"];
    const eventSite = typeof tag === "string" && tag ? eventOrigin(tag) : "";
    const profileURL = idOrigin && eventSite
        ? `${idOrigin}/profile?return_to=${encodeURIComponent(`${eventSite}/`)}`
        : "";
    const landing = !edited?.landing && content.data ? content.data.LandingDraft ?? content.data.Landing : null;
    return {
        options: [
            ...(edited ? documentAnchors(edited.document).map(item => ({value: `#${item.anchor}`, label: `Якір на цій сторінці · ${item.label}`})) : []),
            {value: "/", label: "Головна сторінка"},
            ...(landing ? documentAnchors(landing).map(item => ({value: `/#${item.anchor}`, label: `Головна · ${item.label}`})) : []),
            {value: "/challenges", label: "Завдання"},
            {value: "/scoreboard", label: "Результати"},
            {value: "/participation", label: "Моя участь"},
            ...(profileURL ? [{value: profileURL, label: "Профіль"}] : []),
            ...(pages.data ?? []).flatMap(page => {
                // Links point to the address the page will have once its draft is published.
                const slug = page.Draft?.Slug ?? page.Slug;
                const title = page.Draft?.Title ?? page.Title;
                const document = page.Draft?.Document ?? page.Document;
                const current = edited && !edited.landing && edited.document === document;
                return [
                    {value: `/${slug}`, label: `Додаткова · ${title}`},
                    ...(current ? [] : documentAnchors(document).map(item => ({value: `/${slug}#${item.anchor}`, label: `${title} · ${item.label}`}))),
                ];
            }),
        ],
        pagesError: pages.isError,
    };
}
