"use client";

import {createContext, useContext, useEffect, type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {getClientEventInfo} from "@/api/clientEventInfo";
import {getManageAccess} from "@/api/manage";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {GuestShell} from "./GuestShell";
import {EventErrorScreen} from "./EventErrorScreen";
import {EventLoading} from "./EventLoading";
import {EventUnavailableScreen} from "./EventUnavailableScreen";
import {EventBrandProvider} from "./EventBrandLogo";
import {OutageShell} from "./OutageShell";
import {loadFailure} from "@/utils/loadFailure";
import {t} from "@/i18n/t";

const PrivateEventContext = createContext<PublicEventInfo | null>(null);

export function usePrivateEvent(): PublicEventInfo | null {
    return useContext(PrivateEventContext);
}

export function PrivateEventBootstrap({children}: {children: ReactNode}) {
    const pathname = usePathname();
    const identity = useQuery({
        queryKey: ["event-manager-public-info"], queryFn: getClientEventInfo,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });
    const access = useQuery({
        queryKey: ["event-management-access", identity.data?.EventID],
        queryFn: () => getManageAccess(identity.data!.EventID),
        enabled: !!identity.data,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!identity.data) return;
        const root = document.documentElement;
        root.style.setProperty("--ev-brand", identity.data.Theme.Brand);
        root.style.setProperty("--ev-accent-light", identity.data.Theme.AccentLight);
        root.style.setProperty("--ev-accent-dark", identity.data.Theme.AccentDark);
        root.style.setProperty("--ev-accent-live", identity.data.Theme.AccentLive);
        document.title = identity.data.Name;
    }, [identity.data]);

    if (identity.isPending || (identity.data && access.isPending)) {
        return <EventLoading event={identity.data} full label={t("shell.preview.loading")} />;
    }
    if (identity.isError || access.isError) {
        const failure = loadFailure(identity.error ?? access.error);
        // The backend is unavailable (network failure, or a proxy 502/503/504): the guest frame stays under the
        // outage modal and the queries refetch once the API answers.
        if (failure === "unavailable") return <OutageShell />;
        // 401, 403 and 404 do not say whether the event is missing, closed or private to this
        // visitor, and a redirect would reveal that it exists: one neutral screen for all three.
        // (An unknown event address answers without CORS headers; the query turns that into a 404.)
        if (failure === "notFound") return <EventUnavailableScreen />;
        // Any other failure (the backend answered with an error) is a load failure with a retry.
        return <EventErrorScreen page title={t("error.load.title")} body={t("error.load.body")} error={identity.error ?? access.error} onRetry={() => {void identity.refetch(); void access.refetch();}} />;
    }
    const event = identity.data!;
    return <EventBrandProvider logoURL={event.LogoURL}><PrivateEventContext.Provider value={event}>
        <GuestShell event={event} authenticated notice={<div className="event-private-preview-banner" role="status">
            <span>{t("shell.preview.banner")}</span>
            <Link href={pathname === "/" ? "/manage/content/landing" : "/manage"}>{pathname === "/" ? t("shell.preview.editLanding") : t("shell.preview.manage")}</Link>
        </div>}>
            {children}
        </GuestShell>
    </PrivateEventContext.Provider></EventBrandProvider>;
}
