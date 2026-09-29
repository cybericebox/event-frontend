import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import {liveWidgetLabels} from "./liveLayout";
import {liveListGeometry, liveTimerFit, liveTitleFit, type LiveListGeometry} from "./liveFit";
import {t} from "@/i18n/t";

// Live typography (LIVE-CONSTRUCTOR §2): sizes are multiples of
// u = screen height / 36 × text scale, never below the LED floors
// (body 19 px, captions 14 px, timer 34 px). live.css reads the same numbers
// through liveTextVars, so the editor warnings match the rendered screen.
export const liveTextRoles = {
    display: {k: 1.07, min: 19, label: t("live.text.role.display")},
    timer: {k: 1.87, min: 34, label: t("live.text.role.timer")},
    body: {k: 0.87, min: 19, label: t("live.text.role.body")},
    caption: {k: 0.6, min: 14, label: t("live.text.role.caption")},
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
    // Title and timer size themselves to the widget (liveFit); their warnings
    // come from the fit, not from the role floors.
    title: [], timer: [], chart: ["caption"], table: ["body", "caption"],
    ad_table: [], logos: ["caption"], solves: ["body", "caption"], announcement: ["display"], qr: ["caption"],
};

export type LiveTextWarning = {id: string; text: string};

// The widget's inner box on the real screen, in screen pixels (the widget
// padding is --live-pad).
export function liveWidgetBox(layout: LiveLayout, item: LiveWidget): {width: number; height: number} {
    const {width, height, textScale} = layout.screen;
    const pad = Math.max(6, liveUnit(height, textScale) * 0.4);
    return {width: item.w * width / layout.grid.cols - 2 * pad, height: item.h * height / layout.grid.rows - 2 * pad};
}

// Rows of a table or recent-solves widget on the real screen: the same rule
// the screen renders with.
export function liveListFit(layout: LiveLayout, item: LiveWidget): LiveListGeometry & {rows: number} {
    const {height, textScale} = layout.screen;
    const rows = item.type === "table" ? numberProp(item, "rowsPerPage", 10) : numberProp(item, "rows", 5);
    const geometry = liveListGeometry({height: liveWidgetBox(layout, item).height, caption: liveTextSize("caption", height, textScale).effective,
        body: liveTextSize("body", height, textScale).effective, rows, header: item.type === "table"});
    return {...geometry, rows};
}

function numberProp(item: LiveWidget, key: string, fallback: number): number {
    const value = Number(item.props[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Small-text and fit warnings for the chosen screen size: a role whose
// natural size falls under its floor is raised to the floor on screen, and a
// widget whose content no longer fits at the effective sizes is named.
export function liveTextWarnings(layout: LiveLayout): LiveTextWarning[] {
    const {height, textScale} = layout.screen;
    const size = (role: LiveTextRole) => liveTextSize(role, height, textScale);
    const heading = size("caption").effective * 1.2 + size("caption").effective * 0.5;
    const warnings: LiveTextWarning[] = [];
    for (const item of layout.widgets) {
        if (item.type === "ad_table") continue;
        const name = liveWidgetLabels[item.type];
        const low = widgetRoles[item.type].filter(role => size(role).natural < liveTextRoles[role].min);
        if (low.length) {
            warnings.push({id: item.id, text: t("live.text.warning", {name, problem: t("live.text.belowFloor", {
                sizes: low.map(role => t("live.text.roleSize", {role: liveTextRoles[role].label, size: Math.floor(size(role).natural)})).join(", "),
                floors: low.map(role => `${liveTextRoles[role].min} px`).join(" / "),
            })})});
        }
        const box = liveWidgetBox(layout, item);
        const fit = item.type === "table" || item.type === "solves" ? listProblem(liveListFit(layout, item)) : fitProblem(item, box.width, box.height, heading, size);
        if (fit) warnings.push({id: item.id, text: t("live.text.warning", {name, problem: fit})});
    }
    return warnings;
}

function listProblem(fit: LiveListGeometry & {rows: number}): string | null {
    return fit.readable ? null : t("live.text.rowsFit", {rows: fit.rows, max: fit.maxRows});
}

function fitProblem(item: LiveWidget, boxW: number, boxH: number, heading: number, size: (role: LiveTextRole) => {effective: number}): string | null {
    const caption = size("caption").effective;
    if (item.type === "title") {
        const fit = liveTitleFit({width: boxW, height: boxH, name: t("live.text.sampleTitle"), subtitle: typeof item.props.subtitle === "string" && !!item.props.subtitle.trim(), logo: true});
        return fit.name < liveTextRoles.display.min ? t("live.text.titleFit") : null;
    }
    if (item.type === "announcement") {
        return boxH < size("display").effective * 1.15 ? t("live.text.titleFit") : null;
    }
    if (item.type === "timer") {
        const label = item.props.showLabel === false ? null : typeof item.props.label === "string" && item.props.label.trim() ? item.props.label.trim() : t("live.timer.untilFinish");
        const labelSize = (["s", "m", "l"] as const).find(value => value === item.props.labelSize) ?? "m";
        const fit = liveTimerFit({width: boxW, height: boxH, digits: item.props.showSeconds === false ? 5 : 8, label, labelSize});
        return fit.digits < liveTextRoles.timer.min || label !== null && fit.label < liveTextRoles.caption.min ? t("live.text.timerFit") : null;
    }
    if (item.type === "chart") {
        const lines = Math.min(10, numberProp(item, "lines", 5));
        return boxH - heading - caption * 1.6 < lines * caption * 1.25 ? t("live.text.chartFit", {lines}) : null;
    }
    if (item.type === "logos") return boxH < caption * 1.8 + 24 ? t("live.text.logosFit") : null;
    if (item.type === "qr") return Math.min(boxW, boxH - caption * 1.3) < 80 ? t("live.text.qrFit") : null;
    return null;
}
