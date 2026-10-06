"use client";

import {useEffect, useState, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {getClientEventInfo} from "@/api/clientEventInfo";
import {ManagerShell} from "./ManagerShell";
import {EventErrorScreen} from "../EventErrorScreen";
import {EventLoading} from "../EventLoading";
import {EventBrandProvider} from "../EventBrandLogo";
import {OutageShell} from "../OutageShell";
import {EventUnavailableScreen} from "../EventUnavailableScreen";
import {loadFailure} from "@/utils/loadFailure";
import {t} from "@/i18n/t";

export function ManagerBootstrap({children}: {children: ReactNode}) {
    const event = useQuery({
        queryKey: ["event-manager-public-info"],
        queryFn: getClientEventInfo,
        retry: false,
        refetchInterval: false,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!event.data) return;
        const root = document.documentElement;
        root.style.setProperty("--ev-brand", event.data.Theme.Brand);
        root.style.setProperty("--ev-accent-light", event.data.Theme.AccentLight);
        root.style.setProperty("--ev-accent-dark", event.data.Theme.AccentDark);
        root.style.setProperty("--ev-accent-live", event.data.Theme.AccentLive);
    }, [event.data]);

    // Every /manage page carries «Event | Cyber ICE Box»; the route's own metadata
    // (a bare brand title) rewrites the tab on navigation, so the title is re-asserted.
    // The shell reports the open section: «{Вкладка} · Панель заходу · {Захід}».
    const [section, setSection] = useState<string | null>(null);
    const eventName = event.data?.Name;
    useEffect(() => {
        if (!eventName) return;
        const title = section ? t("manage.shell.tabTitle", {tab: section, name: eventName}) : t("manage.shell.documentTitle", {name: eventName});
        const apply = () => { if (document.title !== title) document.title = title; };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.head, {subtree: true, childList: true, characterData: true});
        return () => observer.disconnect();
    }, [eventName, section]);

    if (event.isPending) return <EventLoading full label={t("manage.shell.loadingEvent")} />;
    if (event.isError) {
        const failure = loadFailure(event.error);
        // The backend is unavailable: the /manage frame stays under the outage modal and the query refetches once
        // the API answers.
        if (failure === "unavailable") return <OutageShell manage />;
        // 401, 403 and 404 do not say whether the event is missing, closed or private to this
        // visitor, and a redirect would reveal that it exists: one neutral screen for all three.
        // (An unknown event address answers without CORS headers; the query turns that into a 404.)
        if (failure === "notFound") return <EventUnavailableScreen />;
        return <EventErrorScreen page body={t("error.load.body")} error={event.error} onRetry={() => void event.refetch()} />;
    }
    return <EventBrandProvider logoURL={event.data.LogoURL}><ManagerShell event={event.data} onSection={setSection}>{children}</ManagerShell></EventBrandProvider>;
}
