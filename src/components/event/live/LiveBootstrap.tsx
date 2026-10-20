"use client";

import {useEffect, useState, useSyncExternalStore} from "react";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {getManageAccess, ManageApiError} from "@/api/manage";
import {getLiveScreenByLink, liveScreenTokenFromHash, LiveScreenLinkError} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {LiveScreenStart} from "@/api/liveScreenServer";
import {LiveFailure, LiveLinkClosed, LiveLinkNotFound, LiveScreen, LiveState} from "./LiveScreen";
import {useLiveRetry} from "./liveRecovery";
import "./live.css";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {loadFailure} from "@/utils/loadFailure";
import {EventUnavailableScreen} from "@/components/event/EventUnavailableScreen";
import {NoAccessScreen} from "@/components/event/NoAccessScreen";
import {SignInRedirect} from "@/components/event/SignInRedirect";

function applyEventTheme(event: PublicEventInfo) {
    const root = document.documentElement;
    root.style.setProperty("--ev-brand", event.Theme.Brand);
    root.style.setProperty("--ev-accent-light", event.Theme.AccentLight);
    root.style.setProperty("--ev-accent-dark", event.Theme.AccentDark);
    root.style.setProperty("--ev-accent-live", event.Theme.AccentLive);
    document.title = t("live.documentTitle", {name: event.Name});
}

// The event, its layout and stages are re-read this often, so a moved start
// or finish, a new name or colours reach an open screen.
const liveEventRefreshMs = 30_000;
const liveNotFoundRecheckMs = 60_000;

function linkStatus(error: unknown): number | null {
    return error instanceof LiveScreenLinkError ? error.status : null;
}

// A projector PC opened with a screen link (/live?token=…): no session, the
// link alone opens this event's staff live screen. The server already read
// the link (`start`): the screen comes in the first HTML, and a closed link or
// a missing event is final. A temporary failure is retried here by itself
// (nobody presses a button on a projector).
function LiveLinkBootstrap({token, start}: {token: string; start?: LiveScreenStart}) {
    const final = start?.kind === "closed" || start?.kind === "notFound";
    // A missing or unpublished event re-checks quietly once a minute and opens by itself once it is published.
    const [checking, setChecking] = useState(!final);
    useEffect(() => {
        if (start?.kind !== "notFound") return;
        const timer = setTimeout(() => setChecking(true), liveNotFoundRecheckMs);
        return () => clearTimeout(timer);
    }, [start?.kind]);
    const screen = useQuery({
        queryKey: ["event-live-link", token], queryFn: () => getLiveScreenByLink(token), retry: false, refetchOnWindowFocus: false,
        enabled: checking && start?.kind !== "closed",
        // The server just read it: no second read before the regular re-read.
        ...(start?.kind === "ok" ? {initialData: start.screen, initialDataUpdatedAt: start.serverNow, staleTime: liveEventRefreshMs} : {}),
        refetchInterval: query => linkStatus(query.state.error) === 404 && !query.state.data ? liveNotFoundRecheckMs : liveEventRefreshMs,
    });
    useEffect(() => {if (screen.data) applyEventTheme(screen.data.Event);}, [screen.data]);
    const status = linkStatus(screen.error);
    const closed = start?.kind === "closed" || status === 403;
    // A missing or unpublished event (404) is final; only a temporary failure (network, 5xx) retries.
    const notFound = !screen.data && (start?.kind === "notFound" || status === 404);
    const retryIn = useLiveRetry(screen.isError && !screen.data && !closed && !notFound, screen.errorUpdatedAt, () => void screen.refetch());
    if (closed) return <LiveLinkClosed event={screen.data?.Event} />;
    if (notFound) return <LiveLinkNotFound />;
    if (screen.isError && !screen.data) return <LiveFailure message={t("live.openFailed.title")} error={screen.error} retryIn={retryIn} onRetry={() => void screen.refetch()} />;
    if (!screen.data) return <LiveState><EventLoading label={t("live.link.checking")} /></LiveState>;
    return <LiveScreen event={screen.data.Event} token={token} link={screen.data} serverNow={start?.kind === "ok" ? start.serverNow : undefined} />;
}

function subscribeHash(onChange: () => void) {
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
}

// A link of the older form (/live#screen=…): the token moves into the query
// once and the page loads again, now rendered by the server.
function useFragmentMigration(): boolean {
    const legacy = useSyncExternalStore(subscribeHash, () => liveScreenTokenFromHash(window.location.hash), () => null);
    useEffect(() => {
        if (!legacy) return;
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.set("token", legacy);
        window.history.replaceState(null, "", url);
        window.location.reload();
    }, [legacy]);
    return !!legacy;
}

export function LiveBootstrap({link}: {link?: {token: string; start: LiveScreenStart}}) {
    const migrating = useFragmentMigration();
    if (link) return <LiveLinkBootstrap token={link.token} start={link.start} />;
    if (migrating) return <LiveState><EventLoading label={t("live.link.checking")} /></LiveState>;
    return <LiveStaffBootstrap />;
}

// L1: a moderator opens the screen under their own account and puts it on
// the projector, so management access is checked first and everything is
// read through the browser session (works before publication). Participants
// and guests have the results page instead.
function LiveStaffBootstrap() {
    const event = useQuery({queryKey: ["event-live-info"], queryFn: getClientEventInfo, retry: false, refetchOnWindowFocus: false, refetchInterval: liveEventRefreshMs});
    const access = useQuery({
        queryKey: ["event-management-access", event.data?.EventID], queryFn: () => getManageAccess(event.data!.EventID),
        enabled: !!event.data, retry: false, refetchOnWindowFocus: false,
    });
    useEffect(() => {if (event.data) applyEventTheme(event.data);}, [event.data]);

    // Only the first load decides: a failed re-read keeps the open screen.
    const failed = (event.data ? null : event.error) ?? (access.data ? null : access.error);
    const status = failed instanceof ClientEventInfoError || failed instanceof ManageApiError ? failed.status : 0;
    const permanent = !!failed && (status === 401 || status === 403 || event.isError && !event.data && loadFailure(event.error) === "notFound");
    // The query that has no data yet is the one to load again.
    const retryStaff = () => void (!event.data ? event.refetch() : access.refetch());
    const retryIn = useLiveRetry(!!failed && !permanent, event.errorUpdatedAt + access.errorUpdatedAt, retryStaff);
    if (failed) {
        // The event itself is not readable: the one neutral screen, never a redirect.
        if (event.isError && !event.data && loadFailure(event.error) === "notFound") return <EventUnavailableScreen />;
        // The event is visible, the live screen is not: sign in, or no rights for it.
        if (status === 401) return <SignInRedirect event={event.data} />;
        if (status === 403) return <NoAccessScreen title={t("live.forbidden.title")} homeHref="/" />;
        return <LiveFailure event={event.data} message={t("live.openFailed.title")} error={failed} retryIn={retryIn} onRetry={retryStaff} />;
    }
    if (!event.data || !access.data) return <LiveState event={event.data}><EventLoading event={event.data} label={t("live.checkingAccess")} /></LiveState>;
    return <LiveScreen event={event.data} />;
}
