"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";
import {EmptyState} from "@/components/ui/EmptyState";
import {liveCaptionBlock, liveEstimateWidth, liveListGeometry, type LiveListGeometry} from "./liveFit";

// Effective text sizes of one block on the screen, in px (liveTextSize with
// the block's own text size); the timer floor of the screen profile.
export type LiveMetrics = {caption: number; body: number; display: number; timer: number};

export function useElementSize<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [size, setSize] = useState({width: 0, height: 0});
    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) => setSize({width: entry.contentRect.width, height: entry.contentRect.height}));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, size] as const;
}

// Text width on the screen: the canvas measures the real font; without a
// canvas (tests, old browsers) the estimate stands in.
let measureContext: CanvasRenderingContext2D | null | undefined;
export function measureName(text: string, font: number): number {
    if (measureContext === undefined) {
        try {measureContext = document.createElement("canvas").getContext("2d");} catch {measureContext = null;}
    }
    if (!measureContext) return liveEstimateWidth(text, font);
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() || "Arial, sans-serif";
    measureContext.font = `500 ${font}px ${family}`;
    return measureContext.measureText(text).width;
}

// A block caption («Таблиця результатів»), or none when the block hides it.
export function LiveCaption({caption, metrics, children}: {caption: ReactNode; metrics: LiveMetrics; children?: ReactNode}) {
    return <h2 style={{height: metrics.caption * liveCaptionBlock}}>{caption}{children}</h2>;
}

// Table, solves and stages: exactly N rows split the height under the
// caption (liveListGeometry, the same rule as the editor warnings).
export function LiveList({caption, rows, header, metrics, empty, progress, children}: {
    // null: the block hides its caption and the rows take its room.
    caption: ReactNode | null; rows: number; header: boolean; metrics: LiveMetrics; empty: string | null;
    // The page bar of a paged table: restarts with each page.
    progress?: {page: number; seconds: number; elapsed: number} | null;
    children: (geometry: LiveListGeometry, width: number) => ReactNode;
}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const geometry = liveListGeometry({height: size.height, caption: metrics.caption, body: metrics.body, rows, header, captionShown: caption !== null});
    return <div className="live-list" ref={ref}>
        {caption !== null && <LiveCaption caption={caption} metrics={metrics}>
            {progress && <PageProgress key={progress.page} seconds={progress.seconds} elapsed={progress.elapsed} />}
        </LiveCaption>}
        {empty !== null ? <EmptyState compact message={empty} /> : children(geometry, size.width)}
    </div>;
}

// The thin bar that fills over the page time. Its start offset is taken once,
// when the page appears: the screen clock ticks every second, and changing the
// animation delay on every tick would push the bar ahead each time, so it ran
// out early and then jumped back at the page turn.
export function PageProgress({seconds, elapsed}: {seconds: number; elapsed: number}) {
    const [offset] = useState(elapsed);
    return <i className="live-list__progress" aria-hidden="true" style={{animationDuration: `${seconds}s`, animationDelay: `-${offset}s`}} />;
}
