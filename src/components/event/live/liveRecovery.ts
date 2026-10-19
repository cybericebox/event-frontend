"use client";

import {useEffect, useRef, useState} from "react";

// A projector screen has nobody to press «Спробувати ще раз»: a failed load
// is retried by itself, after 5, 10, then every 30 seconds, without end.
export const liveRetrySteps = [5, 10, 30] as const;

// Seconds before retry number `attempt` (1-based), ±20% so screens that
// failed together do not all come back in the same second.
export function liveRetryDelay(attempt: number, random: () => number = Math.random): number {
    const base = liveRetrySteps[Math.min(Math.max(1, attempt), liveRetrySteps.length) - 1];
    return Math.max(1, Math.round(base * (0.8 + 0.4 * random())));
}

// Retries a failed load by itself. `failedAt` changes with every new failure
// (the query's errorUpdatedAt), which schedules the next, longer pause. When
// a try ends without a new failure while the load still counts as failed
// (another query of the same screen failed), the next try is armed anyway,
// so the screen can never stay waiting. Returns the seconds left before the
// next try while it fails, else null.
export function useLiveRetry(failed: boolean, failedAt: number, retry: () => void): number | null {
    const attempts = useRef(0);
    const retryRef = useRef(retry);
    const [left, setLeft] = useState<number | null>(null);
    const [rearm, setRearm] = useState(0);
    useEffect(() => {retryRef.current = retry;});
    useEffect(() => {
        if (!failed) {
            attempts.current = 0;
            queueMicrotask(() => setLeft(null));
            return;
        }
        attempts.current += 1;
        const delay = liveRetryDelay(attempts.current);
        const deadline = Date.now() + delay * 1000;
        let done = false;
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        const update = () => {
            if (done) return;
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setLeft(remaining);
            if (remaining === 0) {
                done = true;
                clearInterval(timer);
                retryRef.current();
                // A new failure re-runs this effect and clears the watchdog.
                watchdog = setTimeout(() => setRearm(value => value + 1), liveRetrySteps[liveRetrySteps.length - 1] * 1000);
            }
        };
        const timer = setInterval(update, 1000);
        queueMicrotask(update);
        return () => {done = true; clearInterval(timer); clearTimeout(watchdog);};
    }, [failed, failedAt, rearm]);
    return failed ? left ?? liveRetrySteps[0] : null;
}

// The connection counts as lost once it has been down for two refresh
// intervals (at least 10 s): a single slow answer is not a problem.
export function liveConnectionLost(lostSince: number | null, now: number, refreshSeconds: number): boolean {
    return lostSince !== null && now - lostSince >= Math.max(10, 2 * refreshSeconds) * 1000;
}

// The moment the connection was lost when that has lasted long enough to
// tell the hall (the data is as of that moment), else null.
export function useLiveConnection(connected: boolean, refreshSeconds: number): number | null {
    const [lost, setLost] = useState<number | null>(null);
    useEffect(() => {
        if (connected) {
            queueMicrotask(() => setLost(null));
            return;
        }
        const since = Date.now();
        const check = () => {if (liveConnectionLost(since, Date.now(), refreshSeconds)) setLost(since);};
        const timer = setInterval(check, 1000);
        return () => clearInterval(timer);
    }, [connected, refreshSeconds]);
    return connected ? null : lost;
}
