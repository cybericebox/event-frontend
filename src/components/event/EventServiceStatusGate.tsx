"use client";

import {useCallback, useEffect, useId, useRef, useState, useSyncExternalStore} from "react";
import {useRouter} from "next/navigation";
import {useQueryClient} from "@tanstack/react-query";
import {EventBrandLogo} from "./EventBrandLogo";
import {EventButton} from "@/components/ui/EventButton";
import {
    confirmServiceUnavailable,
    getServiceStatus,
    installServiceStatusTracking,
    onServiceRestored,
    probeService,
    reportServiceAvailable,
    subscribeServiceStatus,
} from "@/utils/serviceStatus";
import {t} from "@/i18n/t";
import "@/styles/service-gate.css";

installServiceStatusTracking();

// A failed call is confirmed by one probe before the modal shows, so a single
// flaky request does not cover the page; the modal shows only when the probe
// itself fails.
const CONFIRM_MS = 3000;
// Seconds between automatic tries while the outage lasts.
const BACKOFF_S = [3, 5, 10, 20, 30];

function backoff(attempt: number): number {
    return BACKOFF_S[Math.min(attempt, BACKOFF_S.length - 1)] * 1000;
}

function OutageDialog({onCheck}: {onCheck: () => Promise<void>}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleID = useId();
    const attempt = useRef(0);
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
            attempt.current += 1;
            checkingRef.current = false;
            setChecking(false);
            const at = Date.now();
            setNow(at);
            setDeadline(at + backoff(attempt.current));
        }
    }, [onCheck]);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || dialog.open) return;
        // The top layer makes the page underneath inert while the outage lasts.
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
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

    const seconds = Math.max(1, Math.ceil((deadline - now) / 1000));
    return <dialog ref={ref} className="ib-modal ib-modal--sm event-service-gate" role="alertdialog" aria-modal="true" aria-labelledby={titleID}
        onCancel={event => event.preventDefault()}>
        <div className="ib-modal__body event-service-gate__body">
            <EventBrandLogo className="event-service-gate__logo" size={48} />
            <h2 className="ib-modal__title" id={titleID}>{t("shell.unavailable.title")}</h2>
            <p className="ib-modal__desc">{t("shell.unavailable.body")}</p>
            <p className="event-service-gate__hint" aria-live="polite">{checking ? t("shell.unavailable.checking") : t("shell.unavailable.nextTry", {seconds})}</p>
        </div>
        <footer className="ib-modal__foot event-service-gate__foot">
            <EventButton className="ib-btn" busy={checking} onClick={() => void check()}>{t("shell.unavailable.retryNow")}</EventButton>
        </footer>
    </dialog>;
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
        const id = window.setTimeout(async () => {
            if (await probeService()) reportServiceAvailable();
            else confirmServiceUnavailable();
        }, CONFIRM_MS);
        return () => window.clearTimeout(id);
    }, [status]);

    const onCheck = useCallback(async () => {
        if (!await probeService()) return;
        reportServiceAvailable();
        // The layout read the event on the server; render it again with the event data.
        if (serverUnavailable) router.refresh();
    }, [serverUnavailable, router]);

    if (!serverUnavailable && status !== "down") return null;
    return <OutageDialog onCheck={onCheck} />;
}
