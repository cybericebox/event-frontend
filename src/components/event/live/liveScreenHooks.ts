"use client";

import {useCallback, useEffect, useState, useSyncExternalStore} from "react";

function subscribeFullscreen(onChange: () => void) {
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
}

// The real Fullscreen API: the browser chrome disappears, not just the page's.
export function useFullscreen() {
    const active = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
    const toggle = useCallback(() => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void document.documentElement.requestFullscreen?.({navigationUI: "hide"}).catch(() => undefined);
    }, []);
    return {active, toggle, supported: typeof document !== "undefined" && !!document.fullscreenEnabled};
}

export type WakeLockState = "unsupported" | "active" | "released" | "denied";

const WAKE_RETRY_MS = 30_000;

// Keeps the projector from dimming. The browser drops the lock whenever the
// page is hidden, so it is requested again when the page becomes visible.
export function useWakeLock(enabled: boolean): WakeLockState {
    const [state, setState] = useState<WakeLockState>("released");
    useEffect(() => {
        if (!enabled) return;
        if (!("wakeLock" in navigator)) {queueMicrotask(() => setState("unsupported")); return;}
        let sentinel: WakeLockSentinel | null = null;
        let stopped = false;
        const acquire = async () => {
            if (document.visibilityState !== "visible" || stopped || (sentinel && !sentinel.released)) return;
            try {
                sentinel = await navigator.wakeLock.request("screen");
                if (stopped) {void sentinel.release(); return;}
                setState("active");
                sentinel.addEventListener("release", () => {if (!stopped) setState("released");});
            } catch {
                if (!stopped) setState("denied");
            }
        };
        const onVisibility = () => void acquire();
        void acquire();
        document.addEventListener("visibilitychange", onVisibility);
        // A refused or lost lock is retried on the next click or key press
        // (some browsers grant it only after user activation) and every 30 s.
        const retry = () => void acquire();
        document.addEventListener("pointerdown", retry);
        document.addEventListener("keydown", retry);
        const timer = setInterval(retry, WAKE_RETRY_MS);
        return () => {
            stopped = true;
            document.removeEventListener("visibilitychange", onVisibility);
            document.removeEventListener("pointerdown", retry);
            document.removeEventListener("keydown", retry);
            clearInterval(timer);
            void sentinel?.release().catch(() => undefined);
        };
    }, [enabled]);
    return state;
}

// True after `ms` without pointer or keyboard activity: hides the cursor and
// the on-screen controls on the projector.
export function useIdle(ms: number): boolean {
    const [idle, setIdle] = useState(false);
    useEffect(() => {
        let timer = setTimeout(() => setIdle(true), ms);
        const wake = () => {
            setIdle(false);
            clearTimeout(timer);
            timer = setTimeout(() => setIdle(true), ms);
        };
        const events = ["pointermove", "pointerdown", "keydown", "wheel"] as const;
        events.forEach(name => window.addEventListener(name, wake, {passive: true}));
        return () => {clearTimeout(timer); events.forEach(name => window.removeEventListener(name, wake));};
    }, [ms]);
    return idle;
}

function subscribeResize(onChange: () => void) {
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
}

// The actual window size in CSS px and the device pixel ratio.
export function useWindowSize(): string {
    return useSyncExternalStore(subscribeResize, () => `${window.innerWidth}×${window.innerHeight}@${window.devicePixelRatio}`, () => "");
}
