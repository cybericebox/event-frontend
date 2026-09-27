"use client";

import {useQuery} from "@tanstack/react-query";
import {getManagePages} from "@/api/manage";
import type {ContentValue} from "@/types/eventContent";

export function useEventLinkOptions(eventID: string, values: Record<string, ContentValue>) {
    const pages = useQuery({
        queryKey: ["event-management-pages", eventID],
        queryFn: () => getManagePages(eventID),
        retry: false,
        refetchOnWindowFocus: false,
    });
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    const tag = values["event.tag"];
    const profileURL = domain && typeof tag === "string" && tag
        ? `https://id.${domain}/profile?return_to=${encodeURIComponent(`https://${tag}.${domain}/`)}`
        : "";
    return {
        options: [
            {value: "/", label: "Головна сторінка"},
            {value: "/challenges", label: "Завдання"},
            {value: "/scoreboard", label: "Результати"},
            {value: "/team", label: "Моя участь / команда"},
            {value: "/vpn", label: "Підключення VPN"},
            ...(profileURL ? [{value: profileURL, label: "Профіль"}] : []),
            ...(pages.data ?? []).map(page => ({value: `/${page.Slug}`, label: `Додаткова · ${page.Title}`})),
        ],
        pagesError: pages.isError,
    };
}
