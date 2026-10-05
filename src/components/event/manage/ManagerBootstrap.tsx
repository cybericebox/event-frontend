"use client";

import {useEffect, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {ManagerShell} from "./ManagerShell";
import {EventErrorScreen} from "../EventErrorScreen";
import {EventLoading} from "../EventLoading";
import {EventBrandProvider} from "../EventBrandLogo";
import {OutageShell} from "../OutageShell";
import {EventNotFoundScreen} from "../EventNotFoundScreen";
import {NoAccessScreen} from "../NoAccessScreen";
import {SignInRequired} from "../SignInRequired";
import {isOutageError} from "@/utils/serviceStatus";
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
    const eventName = event.data?.Name;
    useEffect(() => {
        if (!eventName) return;
        const title = t("manage.shell.documentTitle", {name: eventName});
        const apply = () => { if (document.title !== title) document.title = title; };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.head, {subtree: true, childList: true, characterData: true});
        return () => observer.disconnect();
    }, [eventName]);

    if (event.isPending) return <EventLoading full label={t("manage.shell.loadingEvent")} />;
    if (event.isError) {
        const status = event.error instanceof ClientEventInfoError ? event.error.status : 0;
        // An outage keeps the /manage frame; the outage modal covers it and the
        // query refetches once the API answers.
        if (isOutageError(event.error, status)) return <OutageShell manage />;
        if (status === 401) return <SignInRequired />;
        if (status === 403) return <NoAccessScreen title={t("manage.shell.forbiddenTitle")} />;
        // 404 does not say whether the event is missing or closed to this visitor: a visitor
        // goes to the sign-in, a signed-in account gets the neutral "not available" screen.
        if (status === 404) return <EventNotFoundScreen />;
        return <EventErrorScreen page title={t("error.load.title")} body={t("error.load.body")} onRetry={() => void event.refetch()} />;
    }
    return <EventBrandProvider logoURL={event.data.LogoURL}><ManagerShell event={event.data}>{children}</ManagerShell></EventBrandProvider>;
}
