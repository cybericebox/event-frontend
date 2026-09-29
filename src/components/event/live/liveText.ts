import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import {liveWidgetLabels} from "./liveLayout";

// Live typography (LIVE-CONSTRUCTOR §2): sizes are multiples of
// u = screen height / 36 × text scale, never below the LED floors
// (body 19 px, captions 14 px, timer 34 px). live.css reads the same numbers
// through liveTextVars, so the editor warnings match the rendered screen.
export const liveTextRoles = {
    display: {k: 1.07, min: 19, label: "назва"},
    timer: {k: 1.87, min: 34, label: "таймер"},
    body: {k: 0.87, min: 19, label: "основний текст"},
    caption: {k: 0.6, min: 14, label: "підписи"},
} as const;
export type LiveTextRole = keyof typeof liveTextRoles;

export function liveUnit(height: number, textScale: number): number {
    return height / 36 * textScale;
}

export function liveTextSize(role: LiveTextRole, height: number, textScale: number): {natural: number; effective: number} {
    const {k, min} = liveTextRoles[role];
    const natural = Math.round(liveUnit(height, textScale) * k * 10) / 10;
    return {natural, effective: Math.max(min, natural)};
}

// CSS custom properties for .live-canvas: u follows the canvas height (a size
// container), so the full-window screen and the fixed LED area both scale.
export function liveTextVars(textScale: number): Record<string, string> {
    const vars: Record<string, string> = {"--live-u": `calc(100cqh / 36 * ${textScale})`};
    for (const [role, {k, min}] of Object.entries(liveTextRoles)) vars[`--live-fs-${role}`] = `max(${min}px, calc(var(--live-u) * ${k}))`;
    return vars;
}

const widgetRoles: Record<LiveWidget["type"], LiveTextRole[]> = {
    title: ["display", "caption"], timer: ["timer", "caption"], chart: ["caption"], table: ["body", "caption"],
    ad_table: [], logos: ["caption"], solves: ["body", "caption"], announcement: ["display"], qr: ["caption"],
};

export type LiveTextWarning = {id: string; text: string};

function numberProp(item: LiveWidget, key: string, fallback: number): number {
    const value = Number(item.props[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Small-text and fit warnings for the chosen screen size: a role whose
// natural size falls under its floor is raised to the floor on screen, and a
// widget whose content no longer fits at the effective sizes is named.
export function liveTextWarnings(layout: LiveLayout): LiveTextWarning[] {
    const {width, height, textScale} = layout.screen;
    const size = (role: LiveTextRole) => liveTextSize(role, height, textScale);
    const u = liveUnit(height, textScale);
    const pad = Math.max(6, u * 0.4);
    const heading = size("caption").effective * 1.2 + size("caption").effective * 0.5;
    const warnings: LiveTextWarning[] = [];
    for (const item of layout.widgets) {
        if (item.type === "ad_table") continue;
        const name = liveWidgetLabels[item.type];
        const low = widgetRoles[item.type].filter(role => size(role).natural < liveTextRoles[role].min);
        if (low.length) {
            warnings.push({id: item.id, text: `«${name}»: ${low.map(role => `${liveTextRoles[role].label} ${Math.floor(size(role).natural)} px`).join(", ")} — менше за поріг ${low.map(role => `${liveTextRoles[role].min} px`).join(" / ")}; на екрані текст буде збільшено до порога.`});
        }
        const boxW = item.w * width / layout.grid.cols - 2 * pad;
        const boxH = item.h * height / layout.grid.rows - 2 * pad;
        const fit = fitProblem(item, boxW, boxH, heading, size);
        if (fit) warnings.push({id: item.id, text: `«${name}»: ${fit}`});
    }
    return warnings;
}

function fitProblem(item: LiveWidget, boxW: number, boxH: number, heading: number, size: (role: LiveTextRole) => {effective: number}): string | null {
    const body = size("body").effective, caption = size("caption").effective;
    if (item.type === "table" || item.type === "solves") {
        const rows = item.type === "table" ? numberProp(item, "rowsPerPage", 10) : numberProp(item, "rows", 5);
        const header = item.type === "table" ? caption * 1.7 : 0;
        const fits = Math.max(0, Math.floor((boxH - heading - header) / (body * (item.type === "table" ? 1.68 : 1.84))));
        return fits < rows ? `вміщується ${fits} з ${rows} рядків — зменште кількість рядків або збільште віджет.` : null;
    }
    if (item.type === "title" || item.type === "announcement") {
        return boxH < size("display").effective * 1.15 ? "текст не вміщується за висотою." : null;
    }
    if (item.type === "timer") {
        const timer = size("timer").effective;
        return boxH < caption * 1.3 + timer * 1.05 || boxW < timer * 0.62 * 8 ? "таймер не вміщується — збільште віджет." : null;
    }
    if (item.type === "chart") {
        const lines = Math.min(10, numberProp(item, "lines", 5));
        return boxH - heading - caption * 1.6 < lines * caption * 1.25 ? `підписи ${lines} ліній не вміщуються за висотою.` : null;
    }
    if (item.type === "logos") return boxH < caption * 1.3 + 24 ? "логотипи не вміщуються за висотою." : null;
    if (item.type === "qr") return Math.min(boxW, boxH - caption * 1.3) < 80 ? "QR-код замалий для сканування." : null;
    return null;
}
