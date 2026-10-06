"use client";

import {useEffect, useState, type ReactNode} from "react";

export function CountdownWindow({showFrom, target, hideAfterFinish, children}: {
    showFrom?: string | null;
    target?: string | null;
    hideAfterFinish?: boolean;
    children: ReactNode;
}) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!showFrom && !hideAfterFinish) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [showFrom, hideAfterFinish]);
    const start = showFrom ? Date.parse(showFrom) : NaN;
    const end = target ? Date.parse(target) : NaN;
    if (Number.isFinite(start) && now < start) return null;
    if (hideAfterFinish && Number.isFinite(end) && now >= end) return null;
    return children;
}
