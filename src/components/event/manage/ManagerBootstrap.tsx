"use client";

import {useEffect, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {ManagerShell} from "./ManagerShell";
import {EventErrorScreen} from "../EventErrorScreen";
import {EventLoading} from "../EventLoading";
import {EventBrandProvider} from "../EventBrandLogo";
import {OutageShell} from "../OutageShell";
import {idOrigin} from "@/utils/origins";
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
        document.title = t("manage.shell.documentTitle", {name: event.data.Name});
    }, [event.data]);

    if (event.isPending) return <EventLoading full label={t("manage.shell.loadingEvent")} />;
    if (event.isError) {
        const status = event.error instanceof ClientEventInfoError ? event.error.status : 0;
        // An outage keeps the /manage frame; the outage modal covers it and the
        // query refetches once the API answers.
        if (isOutageError(event.error, status)) return <OutageShell manage />;
        if (![401, 403, 404].includes(status)) return <EventErrorScreen page title={t("error.load.title")} body={t("error.load.body")} onRetry={() => void event.refetch()} />;
        return <div className="event-shell-state" role="alert">
            <h1>{t("manage.shell.eventNotFoundTitle")}</h1>
            <p>{t("manage.shell.eventNotFoundBody")}</p>
            <a className="ib-btn ib-btn--primary" href={`${idOrigin}/sign-in?return_to=${encodeURIComponent(window.location.href)}`}>{t("common.signIn")}</a>
        </div>;
    }
    return <EventBrandProvider logoURL={event.data.LogoURL}><ManagerShell event={event.data}>{children}</ManagerShell></EventBrandProvider>;
}
