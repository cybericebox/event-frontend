import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import {apiOrigin} from "@/utils/origins";
import {t, tPlural} from "@/i18n/t";

export const liveWidgetLabels: Record<LiveWidget["type"], string> = {
    title: t("live.widget.title"), timer: t("live.widget.timer"), chart: t("live.widget.chart"), table: t("live.widget.table"),
    ad_table: t("live.widget.ad_table"), logos: t("live.widget.logos"), solves: t("live.widget.solves"),
    announcement: t("live.widget.announcement"), qr: t("live.widget.qr"),
    podium: t("live.widget.podium"), facts: t("live.widget.facts"), stages: t("live.widget.stages"), clock: t("live.widget.clock"),
};

// Widgets offered in the palette: a type with starting props and the cells
// its preview thumbnail shows. Logos come as two items, the fixed organizers
// block and the partners carousel. The A/D table waits for an Attack-Defense
// mode; layouts that already hold one still load and render nothing.
// Each item says in one line what the block shows; the palette lists the items by group.
export const livePaletteGroups = ["results", "time", "info", "brand"] as const;
export type LivePaletteGroup = typeof livePaletteGroups[number];
export type LivePaletteItem = {key: string; type: LiveWidget["type"]; group: LivePaletteGroup; label: string; description: string; props: LiveWidget["props"]; preview: {w: number; h: number}};
export const livePaletteItems: LivePaletteItem[] = [
    {key: "title", type: "title", group: "info", label: liveWidgetLabels.title, description: t("manage.live.paletteDescription.title"), props: {}, preview: {w: 4, h: 1}},
    {key: "timer", type: "timer", group: "time", label: liveWidgetLabels.timer, description: t("manage.live.paletteDescription.timer"), props: {}, preview: {w: 3, h: 1}},
    {key: "chart", type: "chart", group: "results", label: liveWidgetLabels.chart, description: t("manage.live.paletteDescription.chart"), props: {}, preview: {w: 6, h: 4}},
    {key: "table", type: "table", group: "results", label: liveWidgetLabels.table, description: t("manage.live.paletteDescription.table"), props: {}, preview: {w: 4, h: 4}},
    {key: "organizers", type: "logos", group: "brand", label: t("live.preset.organizers"), description: t("manage.live.paletteDescription.organizers"), props: {mode: "fixed", title: t("live.preset.organizers")}, preview: {w: 4, h: 1}},
    {key: "partners", type: "logos", group: "brand", label: t("live.preset.partners"), description: t("manage.live.paletteDescription.partners"), props: {mode: "carousel", title: t("live.preset.partners")}, preview: {w: 4, h: 1}},
    {key: "podium", type: "podium", group: "results", label: liveWidgetLabels.podium, description: t("manage.live.paletteDescription.podium"), props: {}, preview: {w: 6, h: 3}},
    {key: "leaders", type: "podium", group: "results", label: t("live.preset.leaders"), description: t("manage.live.paletteDescription.leaders"), props: {variant: "cards", showRing: true, highlightTop: "medals"}, preview: {w: 9, h: 3}},
    {key: "facts", type: "facts", group: "info", label: liveWidgetLabels.facts, description: t("manage.live.paletteDescription.facts"), props: {}, preview: {w: 5, h: 2}},
    {key: "solves", type: "solves", group: "results", label: liveWidgetLabels.solves, description: t("manage.live.paletteDescription.solves"), props: {}, preview: {w: 4, h: 3}},
    {key: "first", type: "solves", group: "results", label: t("live.preset.firstSolves"), description: t("manage.live.paletteDescription.first"), props: {mode: "first"}, preview: {w: 4, h: 3}},
    {key: "stages", type: "stages", group: "time", label: liveWidgetLabels.stages, description: t("manage.live.paletteDescription.stages"), props: {}, preview: {w: 4, h: 3}},
    {key: "clock", type: "clock", group: "time", label: liveWidgetLabels.clock, description: t("manage.live.paletteDescription.clock"), props: {}, preview: {w: 3, h: 1}},
    {key: "announcement", type: "announcement", group: "info", label: liveWidgetLabels.announcement, description: t("manage.live.paletteDescription.announcement"), props: {}, preview: {w: 4, h: 1}},
    {key: "qr", type: "qr", group: "info", label: liveWidgetLabels.qr, description: t("manage.live.paletteDescription.qr"), props: {}, preview: {w: 2, h: 2}},
];

// The name of a placed widget: its own caption (a logos block: its title),
// else the type name; «Перші розв'язання» for the first-solves feed.
export function liveWidgetName(widget: LiveWidget): string {
    const own = widget.type === "logos" ? widget.props.title : widget.props.caption;
    if (typeof own === "string" && own.trim()) return own.trim();
    if (widget.type === "podium" && widget.props.variant === "cards") return t("live.preset.leaders");
    return widget.type === "solves" && widget.props.mode === "first" ? t("live.preset.firstSolves") : liveWidgetLabels[widget.type];
}

export const liveGridPresets = [{cols: 12, rows: 8}, {cols: 16, rows: 9}, {cols: 24, rows: 16}];

export function liveLogoURL(value: string): string | null {
    if (value.startsWith("/") && !value.startsWith("//")) {
        return value.startsWith("/api/events/") && apiOrigin ? `${apiOrigin}${value}` : value;
    }
    try {const url = new URL(value); return url.protocol === "https:" ? url.href : null;} catch {return null;}
}

// Mirrors the backend live layout limits (minimum 3×3).
export const liveGridLimits = {minCols: 3, maxCols: 48, minRows: 3, maxRows: 32};

export function liveGridValid(cols: number, rows: number): boolean {
    return Number.isInteger(cols) && Number.isInteger(rows) && cols >= liveGridLimits.minCols && cols <= liveGridLimits.maxCols && rows >= liveGridLimits.minRows && rows <= liveGridLimits.maxRows;
}

export const liveWidgetMinimums: Record<LiveWidget["type"], {w: number; h: number}> = {
    title: {w: 3, h: 1}, timer: {w: 2, h: 1}, chart: {w: 4, h: 3}, table: {w: 3, h: 3},
    ad_table: {w: 6, h: 4}, logos: {w: 2, h: 1}, solves: {w: 3, h: 2},
    announcement: {w: 3, h: 1}, qr: {w: 1, h: 1},
    podium: {w: 4, h: 2}, facts: {w: 3, h: 1}, stages: {w: 3, h: 2}, clock: {w: 2, h: 1},
};

function widget(type: LiveWidget["type"], x: number, y: number, w: number, h: number, props: LiveWidget["props"] = {}): LiveWidget {
    return {id: crypto.randomUUID(), type, x, y, w, h, props};
}

// A block's corners: north-west, north-east, south-west, south-east.
export const liveCorners = ["nw", "ne", "sw", "se"] as const;
export type LiveCorner = typeof liveCorners[number];

// Resizing from a corner by (dx, dy) cells: that corner moves, the opposite
// one stays fixed, and the block never gets smaller than its type allows
// (the dragged edge stops at the minimum instead).
export function liveResizeFromCorner<T extends LiveWidget>(start: T, corner: LiveCorner, dx: number, dy: number): T {
    const min = liveWidgetMinimums[start.type];
    const west = corner === "nw" || corner === "sw", north = corner === "nw" || corner === "ne";
    const w = Math.max(min.w, west ? start.w - dx : start.w + dx);
    const h = Math.max(min.h, north ? start.h - dy : start.h + dy);
    return {...start, x: west ? start.x + start.w - w : start.x, y: north ? start.y + start.h - h : start.y, w, h};
}

export function canPlace(layout: LiveLayout, candidate: LiveWidget, ignoreID?: string): boolean {
    const minimum = liveWidgetMinimums[candidate.type];
    return [candidate.x, candidate.y, candidate.w, candidate.h].every(Number.isInteger)
        && candidate.x >= 1 && candidate.y >= 1 && candidate.w >= minimum.w && candidate.h >= minimum.h
        && candidate.x + candidate.w - 1 <= layout.grid.cols && candidate.y + candidate.h - 1 <= layout.grid.rows
        && layout.widgets.every(other => other.id === ignoreID || candidate.x + candidate.w <= other.x || other.x + other.w <= candidate.x || candidate.y + candidate.h <= other.y || other.y + other.h <= candidate.y);
}

export function firstFreeWidget(layout: LiveLayout, type: LiveWidget["type"]): LiveWidget | null {
    const {w, h} = liveWidgetMinimums[type];
    for (let y = 1; y <= layout.grid.rows - h + 1; y++) {
        for (let x = 1; x <= layout.grid.cols - w + 1; x++) {
            const candidate = widget(type, x, y, w, h);
            if (canPlace(layout, candidate)) return candidate;
        }
    }
    return null;
}

// A widget at the grid cell (x, y) with its minimum size, or null when it
// does not fit there.
export function widgetAt(layout: LiveLayout, type: LiveWidget["type"], x: number, y: number): LiveWidget | null {
    const {w, h} = liveWidgetMinimums[type];
    const candidate = widget(type, Math.min(Math.max(1, x), Math.max(1, layout.grid.cols - w + 1)), Math.min(Math.max(1, y), Math.max(1, layout.grid.rows - h + 1)), w, h);
    return canPlace(layout, candidate) ? candidate : null;
}

function overlaps(a: LiveWidget, b: LiveWidget): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// IDs of widgets the backend would reject: overlapping, outside the grid or
// below the type minimum. The editor highlights them instead of refusing a
// grid change.
export function layoutConflicts(layout: LiveLayout): Set<string> {
    const conflicts = new Set<string>();
    layout.widgets.forEach((item, index) => {
        const min = liveWidgetMinimums[item.type];
        if (item.x < 1 || item.y < 1 || item.x + item.w - 1 > layout.grid.cols || item.y + item.h - 1 > layout.grid.rows || item.w < min.w || item.h < min.h) conflicts.add(item.id);
        for (const other of layout.widgets.slice(index + 1)) {
            if (overlaps(item, other)) {conflicts.add(item.id); conflicts.add(other.id);}
        }
    });
    return conflicts;
}

// Grid change (L7): positions and sizes scale proportionally, x' = round(x·cols'/cols)
// on 0-based cells, so 12→24 doubles exactly. A widget that lands on an
// earlier one moves down to the first free rows; when nothing is free below,
// it stays and layoutConflicts reports it.
export function recomputeGrid(layout: LiveLayout, cols: number, rows: number): LiveLayout {
    const sx = cols / layout.grid.cols, sy = rows / layout.grid.rows;
    const order = layout.widgets.map((item, index) => ({item, index})).sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);
    const placed: LiveWidget[] = [];
    const result: LiveWidget[] = [...layout.widgets];
    for (const {item, index} of order) {
        const min = liveWidgetMinimums[item.type];
        const w = Math.min(cols, Math.max(min.w, Math.round(item.w * sx)));
        const h = Math.min(rows, Math.max(min.h, Math.round(item.h * sy)));
        const x = Math.min(Math.max(1, Math.round((item.x - 1) * sx) + 1), cols - w + 1);
        const y = Math.min(Math.max(1, Math.round((item.y - 1) * sy) + 1), rows - h + 1);
        let next = {...item, x, y, w, h};
        for (let shifted = y; shifted <= rows - h + 1; shifted++) {
            const candidate = {...next, y: shifted};
            if (placed.every(other => !overlaps(candidate, other))) {next = candidate; break;}
        }
        placed.push(next);
        result[index] = next;
    }
    return {...layout, grid: {cols, rows}, widgets: result};
}

export type DistributeAxis = "row" | "column";

// «Розподілити рівномірно»: the selected widget's neighbours sharing its rows
// (or columns) get equal widths (or heights) across the span they cover.
// Returns an error text when the result would break a minimum or an overlap.
export function distributeWidgets(layout: LiveLayout, id: string, axis: DistributeAxis): LiveLayout | string {
    const anchor = layout.widgets.find(item => item.id === id);
    if (!anchor) return t("live.distribute.noWidget");
    const row = axis === "row";
    const group = layout.widgets
        .filter(item => row ? item.y === anchor.y && item.h === anchor.h : item.x === anchor.x && item.w === anchor.w)
        .sort((a, b) => row ? a.x - b.x : a.y - b.y);
    if (group.length < 2) return row ? t("live.distribute.noRowPeers") : t("live.distribute.noColumnPeers");
    const start = row ? group[0].x : group[0].y;
    const end = Math.max(...group.map(item => row ? item.x + item.w : item.y + item.h));
    const span = end - start, base = Math.floor(span / group.length), extra = span % group.length;
    let cursor = start;
    const sized = new Map(group.map((item, index) => {
        const size = base + (index < extra ? 1 : 0);
        const next = row ? {...item, x: cursor, w: size} : {...item, y: cursor, h: size};
        cursor += size;
        return [item.id, next] as const;
    }));
    const next = {...layout, widgets: layout.widgets.map(item => sized.get(item.id) ?? item)};
    const broken = [...sized.values()].find(item => liveWidgetMinimums[item.type][row ? "w" : "h"] > (row ? item.w : item.h));
    if (broken) return tPlural("live.distribute.tooSmall", liveWidgetMinimums[broken.type][row ? "w" : "h"], {name: liveWidgetLabels[broken.type]});
    if ([...sized.keys()].some(key => layoutConflicts(next).has(key) && !layoutConflicts(layout).has(key))) return t("live.distribute.overlap");
    return next;
}
