"use client";

import {useEffect, useRef, useState} from "react";
import {apiOrigin} from "@/utils/origins";
import {jitter} from "@/utils/jitter";

// SSE with a snapshot fallback: the stream only tells the page to reload.
// "live" — the stream is open; "fallback" — it failed repeatedly, poll instead.
export type StreamMode = "connecting" | "live" | "fallback";

export const streamFailureLimit = 3;

// A stream that fell back to polling keeps trying to reconnect this often.
export const fallbackRetryMs = 30_000;

// The named event every live stream sends while idle (sse.Heartbeat).
export const heartbeatEvent = "heartbeat";

// 1 s, 2 s, 4 s … capped at 30 s between reconnects after errors.
export function reconnectDelay(failures: number): number {
    return Math.min(30_000, 1000 * 2 ** Math.max(0, failures - 1));
}

export function streamMode(failures: number, open: boolean): StreamMode {
    if (failures >= streamFailureLimit) return "fallback";
    return open ? "live" : "connecting";
}

// Coalesces bursts of stream events into one reload.
export function debounce(fn: () => void, wait: number): {call: () => void; cancel: () => void} {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return {
        call: () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => { timer = null; fn(); }, wait);
        },
        cancel: () => { if (timer) clearTimeout(timer); timer = null; },
    };
}

export function apiURL(path: string): string | null {
    return apiOrigin ? `${apiOrigin}/api/${path}` : null;
}

// useEventStream opens url() while enabled and calls onChange (debounced) on
// every listed event. `reset` events (snapshot-required) close the stream;
// it reopens with a fresh url() after the reload. Errors back off with jitter
// and, after streamFailureLimit tries, the hook reports "fallback" so callers
// poll. With pauseWhenHidden the stream closes while the tab is hidden and,
// once it is shown again, reloads at once and reopens. A stream in fallback
// keeps retrying every fallbackRetryMs and goes live again when it opens.
// onAlive fires whenever the stream proves the page is current: on open, on
// every listed event and on the server heartbeat.
export function useEventStream({url, events, resetEvents = [], onChange, onAlive, enabled, debounceMs = 1000, pauseWhenHidden = false}: {
    url: () => string | null;
    events: string[];
    resetEvents?: string[];
    onChange: () => void;
    onAlive?: () => void;
    enabled: boolean;
    debounceMs?: number;
    pauseWhenHidden?: boolean;
}): StreamMode {
    const [state, setState] = useState<{failures: number; open: boolean}>({failures: 0, open: false});
    const latest = useRef({url, onChange, onAlive});
    useEffect(() => { latest.current = {url, onChange, onAlive}; });
    const eventsKey = events.join(",");
    const resetKey = resetEvents.join(",");
    useEffect(() => {
        if (!enabled || typeof EventSource === "undefined") return;
        let source: EventSource | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let failures = 0;
        let stopped = false;
        let paused = false;
        const reload = debounce(() => latest.current.onChange(), debounceMs);
        const close = () => { source?.close(); source = null; };
        const schedule = (delay: number) => { if (!stopped) timer = setTimeout(connect, delay); };
        function connect() {
            timer = null;
            const target = latest.current.url();
            if (!target || stopped || paused) return;
            source = new EventSource(target, {withCredentials: true});
            source.onopen = () => { failures = 0; setState({failures: 0, open: true}); latest.current.onAlive?.(); };
            for (const name of eventsKey.split(",").filter(Boolean)) source.addEventListener(name, () => { reload.call(); latest.current.onAlive?.(); });
            source.addEventListener(heartbeatEvent, () => latest.current.onAlive?.());
            for (const name of resetKey.split(",").filter(Boolean)) source.addEventListener(name, () => {
                close();
                setState(current => ({...current, open: false}));
                latest.current.onChange();
                schedule(jitter(1000));
            });
            source.onerror = () => {
                close();
                failures += 1;
                setState({failures, open: false});
                latest.current.onChange();
                schedule(jitter(failures < streamFailureLimit ? reconnectDelay(failures) : fallbackRetryMs));
            };
        }
        const onVisibility = () => {
            if (document.hidden) {
                paused = true;
                reload.cancel();
                if (timer) clearTimeout(timer);
                timer = null;
                close();
                setState(current => ({...current, open: false}));
                return;
            }
            if (!paused) return;
            // Shown again: reload now, then reopen from the fresh snapshot
            // (a stream that fell back to polling gets another chance).
            paused = false;
            failures = 0;
            setState({failures: 0, open: false});
            latest.current.onChange();
            schedule(jitter(1000));
        };
        if (pauseWhenHidden) {
            document.addEventListener("visibilitychange", onVisibility);
            paused = document.hidden;
        }
        connect();
        return () => {
            stopped = true;
            if (pauseWhenHidden) document.removeEventListener("visibilitychange", onVisibility);
            reload.cancel(); if (timer) clearTimeout(timer); close(); setState({failures: 0, open: false});
        };
    }, [enabled, eventsKey, resetKey, debounceMs, pauseWhenHidden]);
    return streamMode(state.failures, state.open);
}
