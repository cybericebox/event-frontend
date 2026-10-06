"use client";

import {useEffect, useState} from "react";

// The current time, refreshed every minute and when the tab becomes visible again, so a long-open page
// recomputes «finished», editability and link expiry.
export function useNow(intervalMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const tick = () => setNow(Date.now());
        const timer = window.setInterval(tick, intervalMs);
        const visible = () => { if (document.visibilityState === "visible") tick(); };
        document.addEventListener("visibilitychange", visible);
        return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
    }, [intervalMs]);
    return now;
}
