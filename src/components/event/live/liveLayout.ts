import {defaultLiveLayout, type LiveLayout, type LiveWidget} from "@/api/manageLive";

export const liveWidgetLabels: Record<LiveWidget["type"], string> = {
    title: "Назва події", timer: "Таймер", chart: "Графік", table: "Таблиця",
    ad_table: "Таблиця A/D", logos: "Логотипи", solves: "Останні розв’язання",
    announcement: "Оголошення", qr: "QR-код",
};

export function liveLogoURL(value: string): string | null {
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

export function fitGrid(layout: LiveLayout, cols: number, rows: number): LiveLayout | null {
    const next: LiveLayout = {...layout, grid: {cols, rows}, widgets: []};
    for (const item of layout.widgets) {
        const min = liveWidgetMinimums[item.type];
        const w = Math.min(cols, Math.max(min.w, Math.round(item.w * cols / layout.grid.cols)));
        const h = Math.min(rows, Math.max(min.h, Math.round(item.h * rows / layout.grid.rows)));
        let placed = false;
        for (let y = Math.max(1, Math.round((item.y - 1) * rows / layout.grid.rows) + 1); y <= rows - h + 1 && !placed; y++) {
            for (let x = 1; x <= cols - w + 1; x++) {
                const candidate = {...item, x, y, w, h};
                if (canPlace(next, candidate)) {next.widgets.push(candidate); placed = true; break;}
            }
        }
        if (!placed) return null;
    }
    return next;
}
