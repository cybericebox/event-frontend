"use client";

import {useEffect, useSyncExternalStore} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {getManageAccess, ManageApiError} from "@/api/manage";
import {getLiveScreenByLink, liveScreenTokenFromHash, LiveScreenLinkError} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveLinkClosed, LiveScreen} from "./LiveScreen";
import "./live.css";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {EventNotFoundScreen} from "@/components/event/EventNotFoundScreen";
import {NoAccessScreen} from "@/components/event/NoAccessScreen";
import {SignInRequired} from "@/components/event/SignInRequired";

function applyEventTheme(event: PublicEventInfo) {
    const root = document.documentElement;
    root.style.setProperty("--ev-brand", event.Theme.Brand);
    root.style.setProperty("--ev-accent-light", event.Theme.AccentLight);
    root.style.setProperty("--ev-accent-dark", event.Theme.AccentDark);
    root.style.setProperty("--ev-accent-live", event.Theme.AccentLive);
    document.title = t("live.documentTitle", {name: event.Name});
}

// A projector PC opened with a screen link (/live#screen=…): no session, the
// link alone opens this event's staff live screen.
function LiveLinkBootstrap({token}: {token: string}) {
    const screen = useQuery({queryKey: ["event-live-link", token], queryFn: () => getLiveScreenByLink(token), retry: false, refetchOnWindowFocus: false});
    useEffect(() => {if (screen.data) applyEventTheme(screen.data.Event);}, [screen.data]);
    if (screen.error instanceof LiveScreenLinkError && screen.error.status === 403) return <LiveLinkClosed />;
    if (screen.isError) return <main className="live-fullscreen"><EventLoadError message={t("live.openFailed.title")} error={screen.error} onRetry={() => void screen.refetch()} /></main>;
    if (!screen.data) return <main className="live-fullscreen"><EventLoading label={t("live.link.checking")} /></main>;
    return <LiveScreen event={screen.data.Event} token={token} initialLayout={screen.data.Layout} />;
}

function subscribeHash(onChange: () => void) {
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
}

export function LiveBootstrap() {
    // The fragment exists only in the browser: the server renders the loader.
    const token = useSyncExternalStore(subscribeHash, () => liveScreenTokenFromHash(window.location.hash), () => undefined);
    if (token === undefined) return <main className="live-fullscreen"><EventLoading label={t("live.loading")} /></main>;
    return token ? <LiveLinkBootstrap token={token} /> : <LiveStaffBootstrap />;
}

// L1: a moderator opens the screen under their own account and puts it on
// the projector, so management access is checked first and everything is
// read through the browser session (works before publication). Participants
// and guests have the results page instead.
function LiveStaffBootstrap() {
    const event = useQuery({queryKey: ["event-live-info"], queryFn: getClientEventInfo, retry: false, refetchOnWindowFocus: false});
    const access = useQuery({
        queryKey: ["event-management-access", event.data?.EventID], queryFn: () => getManageAccess(event.data!.EventID),
        enabled: !!event.data, retry: false, refetchOnWindowFocus: false,
    });
    useEffect(() => {if (event.data) applyEventTheme(event.data);}, [event.data]);

    const failed = event.error ?? access.error;
    if (failed) {
        const status = failed instanceof ClientEventInfoError || failed instanceof ManageApiError ? failed.status : 0;
        if (status === 401) return <SignInRequired />;
        if (status === 403) return <NoAccessScreen title={t("live.forbidden.title")} homeHref="/" />;
        if (status === 404 && event.isError) return <EventNotFoundScreen />;
        return <main className="live-fullscreen"><EventLoadError message={t("live.openFailed.title")} error={event.error ?? access.error} onRetry={() => void (event.isError ? event.refetch() : access.refetch())} /></main>;
    }
    if (!event.data || !access.data) return <main className="live-fullscreen"><EventLoading event={event.data} label={t("live.checkingAccess")} /></main>;
    return <LiveScreen event={event.data} />;
}
