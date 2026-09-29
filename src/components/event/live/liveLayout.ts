import {defaultLiveLayout, type LiveLayout, type LiveWidget} from "@/api/manageLive";

export const liveWidgetLabels: Record<LiveWidget["type"], string> = {
    title: "Назва події", timer: "Таймер", chart: "Графік", table: "Таблиця",
    ad_table: "Таблиця A/D", logos: "Логотипи", solves: "Останні розв’язання",
    announcement: "Оголошення", qr: "QR-код",
};

// Widgets offered in the palette. The A/D table waits for an Attack-Defense
// mode; layouts that already hold one still load and render nothing.
export const livePaletteTypes = (Object.keys(liveWidgetLabels) as LiveWidget["type"][]).filter(type => type !== "ad_table");

export function liveLogoURL(value: string): string | null {
    // Mock uploads are object URLs.
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1" && value.startsWith("blob:")) return value;
    if (value.startsWith("/") && !value.startsWith("//")) {
        const domain = process.env.NEXT_PUBLIC_DOMAIN;
        return value.startsWith("/api/events/") && domain ? `https://api.${domain}${value}` : value;
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
    classic: {label: "Класика", widgets: () => [widget("title", 1, 1, 12, 1), widget("chart", 1, 2, 8, 6), widget("table", 9, 2, 4, 6), widget("logos", 1, 8, 3, 1, {mode: "fixed", title: "Організатори"}), widget("logos", 4, 8, 9, 1, {mode: "carousel", title: "Партнери"})]},
    chart: {label: "Графік-герой", widgets: () => [widget("title", 1, 1, 10, 1), widget("timer", 11, 1, 2, 1), widget("chart", 1, 2, 12, 6), widget("logos", 1, 8, 12, 1, {mode: "carousel", title: "Партнери"})]},
    table: {label: "Лише таблиця", widgets: () => [widget("title", 1, 1, 12, 1), widget("table", 1, 2, 12, 6), widget("logos", 1, 8, 4, 1, {mode: "fixed", title: "Організатори"}), widget("logos", 5, 8, 8, 1, {mode: "carousel", title: "Партнери"})]},
    side: {label: "Логотипи збоку", widgets: () => [widget("title", 1, 1, 10, 1), widget("timer", 11, 1, 2, 1), widget("chart", 1, 2, 7, 7), widget("table", 8, 2, 3, 7), widget("logos", 11, 2, 2, 7, {mode: "fixed", title: "Організатори"})]},
    empty: {label: "Порожня сітка", widgets: () => [] as LiveWidget[]},
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
    if (!anchor) return "Оберіть віджет.";
    const row = axis === "row";
    const group = layout.widgets
        .filter(item => row ? item.y === anchor.y && item.h === anchor.h : item.x === anchor.x && item.w === anchor.w)
        .sort((a, b) => row ? a.x - b.x : a.y - b.y);
    if (group.length < 2) return row ? "У цьому ряду немає інших віджетів такої ж висоти." : "У цій колонці немає інших віджетів такої ж ширини.";
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
    if (broken) return `«${liveWidgetLabels[broken.type]}» не може бути меншим за ${liveWidgetMinimums[broken.type][row ? "w" : "h"]} клітинки.`;
    if ([...sized.keys()].some(key => layoutConflicts(next).has(key) && !layoutConflicts(layout).has(key))) return "Рівний розподіл перекриє інші віджети.";
    return next;
}
