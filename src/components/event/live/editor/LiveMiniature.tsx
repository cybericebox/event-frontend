"use client";

import {useMemo, type CSSProperties} from "react";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "../LiveCanvas";
import type {LivePaletteItem} from "../liveLayout";

// A live canvas rendered at its native resolution and scaled into a box, so
// thumbnails show the real widget, text sizes included. `crop` shows only
// the top-left cells (a single widget); the rest of the canvas is cut off.
export function LiveMiniature({layout, event, results, sample, box, crop}: {
    layout: LiveLayout; event: PublicEventInfo; results?: ManageResultsSnapshot; sample: boolean;
    box: {width: number; height: number}; crop?: {w: number; h: number};
}) {
    const {width, height} = layout.screen;
    const viewW = crop ? width * crop.w / layout.grid.cols : width;
    const viewH = crop ? height * crop.h / layout.grid.rows : height;
    const scale = Math.min(box.width / viewW, box.height / viewH);
    return <span className="live-mini" style={{width: box.width, height: box.height} as CSSProperties} aria-hidden="true">
        <span className={`live-mini__view live-mini__view--${layout.theme}`} style={{width: viewW * scale, height: viewH * scale}}>
            <span className="live-mini__native" style={{width, height, transform: `scale(${scale})`}} inert>
                <LiveCanvas layout={layout} event={event} results={results} sample={sample} />
            </span>
        </span>
    </span>;
}

// The palette item alone on a small 960×540 12×8 screen, cropped to its
// cells: the LED text floors keep its text readable in the thumbnail.
export function paletteLayout(item: LivePaletteItem, theme: LiveLayout["theme"], props: LiveWidget["props"]): LiveLayout {
    return {
        version: 1, theme, aspect: "16:9", refreshSeconds: 5, screen: {width: 960, height: 540, anchor: "full", textScale: 1},
        grid: {cols: 12, rows: 8}, widgets: [{id: item.key, type: item.type, x: 1, y: 1, w: item.preview.w, h: item.preview.h, props}],
    };
}

export function usePaletteLayouts(items: LivePaletteItem[], theme: LiveLayout["theme"], origin: string) {
    return useMemo(() => new Map(items.map(item => [item.key, paletteLayout(item, theme, item.type === "qr" ? {url: origin} : item.props)])), [items, theme, origin]);
}
