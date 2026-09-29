"use client";

import {createContext, useContext, useEffect, type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {getManageAccess, ManageApiError} from "@/api/manage";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {GuestShell} from "./GuestShell";
import {EventErrorScreen} from "./EventErrorScreen";
import {EventLoading} from "./EventLoading";
import {EventNotFoundScreen} from "./EventNotFoundScreen";
import {EventBrandProvider} from "./EventBrandLogo";
import {OutageShell} from "./OutageShell";
import {isOutageError} from "@/utils/serviceStatus";
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
        const status = identity.error instanceof ClientEventInfoError ? identity.error.status
            : access.error instanceof ManageApiError ? access.error.status : 0;
        // An outage keeps the guest frame under the outage modal; the queries
        // refetch once the API answers.
        if (isOutageError(identity.error ?? access.error, status)) return <OutageShell />;
        // Only a missing event or a missing right sends to the sign-in; any other failure
        // (server error, network) is a load failure with a retry.
        if (![401, 403, 404].includes(status)) return <EventErrorScreen page title={t("error.load.title")} body={t("error.load.body")} onRetry={() => {void identity.refetch(); void access.refetch();}} />;
        return <EventNotFoundScreen />;
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
