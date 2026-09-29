import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import {canPlace, liveWidgetMinimums} from "./liveLayout";

// Screen shapes (LIVE-CONSTRUCTOR §2): the base layout has its own aspect;
// 16:9, 16:10 and 4:3 besides it are «auto» (the base stretched, text sized
// to fit — see liveTextVars) or «custom» (the same widgets on their own
// grid). The live screen picks the shape nearest to its window.
export const liveFormatKeys = ["16:9", "16:10", "4:3"] as const;
export type LiveFormatKey = typeof liveFormatKeys[number];
export type LiveFormat = NonNullable<LiveLayout["formats"]>[string];
export type LivePlacement = {id: string; x: number; y: number; w: number; h: number};

const ratios: Record<string, number> = {"16:9": 16 / 9, "16:10": 16 / 10, "4:3": 4 / 3, "5:3": 5 / 3};

export function liveBaseRatio(layout: LiveLayout): number {
    return layout.aspect === "custom" ? layout.screen.width / layout.screen.height : ratios[layout.aspect];
}

// The shapes the editor offers: the base first, then the others.
export function liveFormatTabs(layout: LiveLayout): string[] {
    return [layout.aspect, ...liveFormatKeys.filter(key => key !== layout.aspect)];
}

export function liveFormatMode(layout: LiveLayout, key: string): "base" | "auto" | "custom" {
    if (key === layout.aspect) return "base";
    return layout.formats?.[key]?.mode === "custom" ? "custom" : "auto";
}

// The layout of one shape, ready to render and edit: the base as it is; an
// «auto» shape is the base on a screen of that shape; a «custom» shape
// places the widgets by its placements (a widget added later is put in the
// first free cells, or kept at its base cells scaled to the grid).
export function liveFormatLayout(layout: LiveLayout, key: string): LiveLayout {
    if (key === layout.aspect) return layout;
    const screen = {...layout.screen, anchor: "full" as const, width: Math.round(layout.screen.height * (ratios[key] ?? liveBaseRatio(layout)))};
    const format = layout.formats?.[key];
    if (!format || format.mode !== "custom" || !format.grid) return {...layout, aspect: key as LiveLayout["aspect"], screen};
    const grid = format.grid;
    const placements = new Map((format.placements ?? []).map(place => [place.id, place]));
    let view: LiveLayout = {...layout, aspect: key as LiveLayout["aspect"], screen, grid, widgets: []};
    const pending: LiveWidget[] = [];
    for (const widget of layout.widgets) {
        const place = placements.get(widget.id);
        if (place) view = {...view, widgets: [...view.widgets, {...widget, x: place.x, y: place.y, w: place.w, h: place.h}]};
        else pending.push(widget);
    }
    for (const widget of pending) view = {...view, widgets: [...view.widgets, placeMissing(view, widget)]};
    return view;
}

function placeMissing(view: LiveLayout, widget: LiveWidget): LiveWidget {
    const minimum = liveWidgetMinimums[widget.type];
    for (let y = 1; y <= view.grid.rows - minimum.h + 1; y++) {
        for (let x = 1; x <= view.grid.cols - minimum.w + 1; x++) {
            const candidate = {...widget, x, y, w: minimum.w, h: minimum.h};
            if (canPlace(view, candidate)) return candidate;
        }
    }
    return {...widget, x: 1, y: 1, w: Math.min(widget.w, view.grid.cols), h: Math.min(widget.h, view.grid.rows)};
}

// A «custom» shape from its current view (the base, when it was «auto»).
export function liveCustomFormat(view: LiveLayout): LiveFormat {
    return {mode: "custom", grid: {...view.grid}, placements: view.widgets.map(({id, x, y, w, h}) => ({id, x, y, w, h}))};
}

// Stores an edited view of a non-base shape back into the layout.
export function withLiveFormatView(layout: LiveLayout, key: string, view: LiveLayout): LiveLayout {
    return {...layout, formats: {...layout.formats, [key]: liveCustomFormat(view)}};
}

export function withLiveFormatMode(layout: LiveLayout, key: string, mode: "auto" | "custom"): LiveLayout {
    const formats = {...layout.formats};
    formats[key] = mode === "auto" ? {mode: "auto"} : liveCustomFormat(liveFormatLayout(layout, key));
    return {...layout, formats};
}

// Formats keep only placements of widgets that still exist; the base shape
// never has a format entry.
export function pruneLiveFormats(layout: LiveLayout): LiveLayout {
    if (!layout.formats) return layout;
    const ids = new Set(layout.widgets.map(widget => widget.id));
    const formats: NonNullable<LiveLayout["formats"]> = {};
    for (const [key, format] of Object.entries(layout.formats)) {
        if (key === layout.aspect) continue;
        formats[key] = format.mode === "custom" ? {...format, placements: (format.placements ?? []).filter(place => ids.has(place.id))} : format;
    }
    return Object.keys(formats).length ? {...layout, formats} : {...layout, formats: undefined};
}

// The shape a live screen of this window ratio uses: the nearest one (on a
// log scale, so 21:9 and 5:4 land on the widest and narrowest).
export function pickLiveFormat(layout: LiveLayout, ratio: number): string {
    if (!Number.isFinite(ratio) || ratio <= 0) return layout.aspect;
    const candidates = [layout.aspect, ...liveFormatKeys.filter(key => key !== layout.aspect)];
    const shapeRatio = (key: string) => key === layout.aspect ? liveBaseRatio(layout) : ratios[key];
    return candidates.reduce((best, key) => Math.abs(Math.log(ratio / shapeRatio(key))) < Math.abs(Math.log(ratio / shapeRatio(best))) ? key : best);
}
