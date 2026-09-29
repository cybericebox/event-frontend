import {defaultLiveLayout, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import {apiOrigin} from "@/utils/origins";
import {t, tPlural} from "@/i18n/t";

export const liveWidgetLabels: Record<LiveWidget["type"], string> = {
    title: t("live.widget.title"), timer: t("live.widget.timer"), chart: t("live.widget.chart"), table: t("live.widget.table"),
    ad_table: t("live.widget.ad_table"), logos: t("live.widget.logos"), solves: t("live.widget.solves"),
    announcement: t("live.widget.announcement"), qr: t("live.widget.qr"),
};

// Widgets offered in the palette: a type with starting props and the cells
// its preview thumbnail shows. Logos come as two items, the fixed organizers
// block and the partners carousel. The A/D table waits for an Attack-Defense
// mode; layouts that already hold one still load and render nothing.
export type LivePaletteItem = {key: string; type: LiveWidget["type"]; label: string; props: LiveWidget["props"]; preview: {w: number; h: number}};
export const livePaletteItems: LivePaletteItem[] = [
    {key: "title", type: "title", label: liveWidgetLabels.title, props: {}, preview: {w: 6, h: 1}},
    {key: "timer", type: "timer", label: liveWidgetLabels.timer, props: {}, preview: {w: 3, h: 1}},
    {key: "chart", type: "chart", label: liveWidgetLabels.chart, props: {}, preview: {w: 6, h: 4}},
    {key: "table", type: "table", label: liveWidgetLabels.table, props: {}, preview: {w: 4, h: 4}},
    {key: "organizers", type: "logos", label: t("live.preset.organizers"), props: {mode: "fixed", title: t("live.preset.organizers")}, preview: {w: 6, h: 1}},
    {key: "partners", type: "logos", label: t("live.preset.partners"), props: {mode: "carousel", title: t("live.preset.partners")}, preview: {w: 6, h: 1}},
    {key: "solves", type: "solves", label: liveWidgetLabels.solves, props: {}, preview: {w: 4, h: 3}},
    {key: "announcement", type: "announcement", label: liveWidgetLabels.announcement, props: {}, preview: {w: 6, h: 1}},
    {key: "qr", type: "qr", label: liveWidgetLabels.qr, props: {}, preview: {w: 2, h: 2}},
];

// The name of a placed widget: logos blocks go by their own title.
export function liveWidgetName(widget: LiveWidget): string {
    return widget.type === "logos" && typeof widget.props.title === "string" && widget.props.title.trim() ? widget.props.title.trim() : liveWidgetLabels[widget.type];
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
};

function widget(type: LiveWidget["type"], x: number, y: number, w: number, h: number, props: LiveWidget["props"] = {}): LiveWidget {
    return {id: crypto.randomUUID(), type, x, y, w, h, props};
}

export const livePresets = {
    classic: {label: t("live.preset.classic"), widgets: () => [widget("title", 1, 1, 10, 1), widget("timer", 11, 1, 2, 1), widget("chart", 1, 2, 8, 6), widget("table", 9, 2, 4, 6), widget("logos", 1, 8, 3, 1, {mode: "fixed", title: t("live.preset.organizers")}), widget("logos", 4, 8, 9, 1, {mode: "carousel", title: t("live.preset.partners")})]},
    chart: {label: t("live.preset.chart"), widgets: () => [widget("title", 1, 1, 10, 1), widget("timer", 11, 1, 2, 1), widget("chart", 1, 2, 12, 6), widget("logos", 1, 8, 12, 1, {mode: "carousel", title: t("live.preset.partners")})]},
    table: {label: t("live.preset.table"), widgets: () => [widget("title", 1, 1, 10, 1), widget("timer", 11, 1, 2, 1), widget("table", 1, 2, 12, 6), widget("logos", 1, 8, 4, 1, {mode: "fixed", title: t("live.preset.organizers")}), widget("logos", 5, 8, 8, 1, {mode: "carousel", title: t("live.preset.partners")})]},
    side: {label: t("live.preset.side"), widgets: () => [widget("title", 1, 1, 10, 1), widget("timer", 11, 1, 2, 1), widget("chart", 1, 2, 7, 7), widget("table", 8, 2, 3, 7), widget("logos", 11, 2, 2, 7, {mode: "fixed", title: t("live.preset.organizers")})]},
    empty: {label: t("live.preset.empty"), widgets: () => [] as LiveWidget[]},
} satisfies Record<string, {label: string; widgets: () => LiveWidget[]}>;

export function presetLayout(key: keyof typeof livePresets, base: LiveLayout = defaultLiveLayout): LiveLayout {
    return {...base, grid: {cols: 12, rows: 8}, widgets: livePresets[key].widgets()};
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
