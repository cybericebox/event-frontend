"use client";

import {useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent} from "react";
import {useRouter} from "next/navigation";
import {useQueryClient} from "@tanstack/react-query";
import {EventBrandLogo} from "./EventBrandLogo";
import {EventButton} from "@/components/ui/EventButton";
import {
    getServiceStatus,
    installServiceStatusTracking,
    onServiceRestored,
    probeService,
    reportServiceAvailable,
    startOutageGrace,
    subscribeServiceStatus,
} from "@/utils/serviceStatus";
import {t} from "@/i18n/t";
import "@/styles/service-down.css";

// The element AppShell wraps around the shell: the overlay dims it and makes it inert.
export const APP_ROOT_ID = "event-app-root";

installServiceStatusTracking();

// A failed call is confirmed by two probes 15 s apart (see startOutageGrace), so
// a short backend restart never flashes the modal.
// Seconds between automatic tries while the outage lasts.
const BACKOFF_S = [3, 5, 10, 20, 30];

function backoff(attempt: number): number {
    return BACKOFF_S[Math.min(attempt, BACKOFF_S.length - 1)] * 1000;
}

function OutageOverlay({onCheck}: {onCheck: () => Promise<void>}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const textId = useId();
    const attemptRef = useRef(0);
    const [deadline, setDeadline] = useState(() => Date.now() + backoff(0));
    const [now, setNow] = useState(() => Date.now());
    const [checking, setChecking] = useState(false);
    const checkingRef = useRef(false);

    const check = useCallback(async () => {
        if (checkingRef.current) return;
        checkingRef.current = true;
        setChecking(true);
        try {
            await onCheck();
        } finally {
            attemptRef.current += 1;
            checkingRef.current = false;
            setChecking(false);
            const at = Date.now();
            setNow(at);
            setDeadline(at + backoff(attemptRef.current));
        }
    }, [onCheck]);

    // The page behind stays rendered, dimmed and inert while the outage lasts; focus moves into the card.
    useEffect(() => {
        const root = document.getElementById(APP_ROOT_ID);
        const opener = document.activeElement as HTMLElement | null;
        root?.classList.add("ib-service-down-behind");
        root?.setAttribute("inert", "");
        root?.setAttribute("aria-hidden", "true");
        cardRef.current?.querySelector<HTMLElement>("button")?.focus();
        return () => {
            root?.classList.remove("ib-service-down-behind");
            root?.removeAttribute("inert");
            root?.removeAttribute("aria-hidden");
            if (opener?.isConnected) opener.focus();
        };
    }, []);

    useEffect(() => {
        if (checking) return;
        const id = window.setInterval(() => {
            const at = Date.now();
            setNow(at);
            if (at >= deadline) void check();
        }, 1000);
        return () => window.clearInterval(id);
    }, [checking, deadline, check]);

    // Esc does nothing; Tab stays on the card's button.
    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Escape" || event.key === "Tab") event.preventDefault();
    }

    const seconds = Math.max(1, Math.ceil((deadline - now) / 1000));
    return <div className="ib-service-down" onKeyDown={onKeyDown}>
        <div ref={cardRef} className="ib-service-down__card" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId} tabIndex={-1}>
            <EventBrandLogo className="ib-service-down__crest" size={36} />
            <h2 className="ib-service-down__title" id={titleId}>{t("shell.unavailable.title")}</h2>
            <p className="ib-service-down__text" id={textId}>{t("shell.unavailable.body")}</p>
            <p className="ib-service-down__status" role="status" aria-live="polite">{checking ? t("shell.unavailable.checking") : t("shell.unavailable.nextTry", {seconds})}</p>
            <EventButton className="ib-btn ib-btn--block" busy={checking} onClick={() => void check()}>{t("shell.unavailable.retryNow")}</EventButton>
        </div>
    </div>;
}

// App-wide outage modal. The API calls report network failures and 5xx into the
// status store; `serverUnavailable` says the server-side event fetch already
// failed. The page stays rendered underneath; the modal cannot be dismissed and
// closes by itself once the API answers, then failed data is fetched again.
export function EventServiceStatusGate({serverUnavailable = false}: {serverUnavailable?: boolean}) {
    const status = useSyncExternalStore(subscribeServiceStatus, getServiceStatus, () => "up" as const);
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => onServiceRestored(() => { void queryClient.invalidateQueries(); }), [queryClient]);

    useEffect(() => {
        if (status !== "suspect") return;
        return startOutageGrace(() => probeService());
    }, [status]);

    const onCheck = useCallback(async () => {
        if (!await probeService()) return;
        reportServiceAvailable();
        // The layout read the event on the server; render it again with the event data.
        if (serverUnavailable) router.refresh();
    }, [serverUnavailable, router]);

    if (!serverUnavailable && status !== "down") return null;
    return <OutageOverlay onCheck={onCheck} />;
}
