import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import {liveWidgetName} from "./liveLayout";
import {liveCardsBox, liveCardsFit, liveFactsFit, liveListGeometry, livePodiumFit, liveTimerFit, liveTitleFit, liveTwoLineRow, type LiveListGeometry} from "./liveFit";
import {liveSampleStages} from "./liveSample";
import {liveStageNameChars, type LiveStage} from "./liveStages";
import {liveFactItems} from "./liveFacts";
import {t} from "@/i18n/t";

// Live typography (LIVE-CONSTRUCTOR §2): sizes are multiples of
// u = screen height / 36 × text scale, never below the floors of the screen
// profile. live.css reads the same numbers through liveTextVars, so the
// editor warnings match the rendered screen.
export const liveTextRoles = {
    display: {k: 1.07, label: t("live.text.role.display")},
    timer: {k: 1.87, label: t("live.text.role.timer")},
    body: {k: 0.87, label: t("live.text.role.body")},
    caption: {k: 0.8, label: t("live.text.role.caption")},
} as const;
export type LiveTextRole = keyof typeof liveTextRoles;

// Floors per screen profile, in px. «led»: a fixed area of an LED wall
// (anchor top-left), large pixels read from afar. «projector»: a projector
// or TV filling the window (720p and up), read from across the hall.
export const liveTextFloors = {
    led: {display: 19, timer: 34, body: 19, caption: 14},
    projector: {display: 24, timer: 40, body: 20, caption: 18},
} as const satisfies Record<string, Record<LiveTextRole, number>>;
export type LiveTextProfile = keyof typeof liveTextFloors;

export function liveTextProfile(screen: Pick<LiveLayout["screen"], "anchor">): LiveTextProfile {
    return screen.anchor === "top-left" ? "led" : "projector";
}

// «Безпечне поле»: the margin around the canvas for TVs that crop the
// picture edges (overscan), in % of each side.
export const liveSafeAreaOptions = [0, 2.5, 5] as const;

export function liveSafeArea(screen: Pick<LiveLayout["screen"], "safeArea">): number {
    return (liveSafeAreaOptions as readonly number[]).includes(screen.safeArea ?? 0) ? screen.safeArea ?? 0 : 0;
}

// The margins of a W×H area in px for a safe area of `percent`.
export function liveSafeInsets(width: number, height: number, percent: number): {x: number; y: number} {
    return {x: Math.round(width * percent / 100), y: Math.round(height * percent / 100)};
}

// The canvas inside the safe area of the layout's screen.
export function liveCanvasSize(layout: LiveLayout): {width: number; height: number} {
    const {width, height} = layout.screen;
    const inset = liveSafeInsets(width, height, liveSafeArea(layout.screen));
    return {width: width - 2 * inset.x, height: height - 2 * inset.y};
}

// u = height / 36, but never more than a 16:9 box of this width allows, so
// a layout made for 16:9 keeps its text inside the widgets on narrower
// screens (4:3, 5:4) — «text scales to height», capped by width.
export function liveUnit(height: number, textScale: number, width: number = Number.POSITIVE_INFINITY): number {
    return Math.min(height, width * 9 / 16) / 36 * textScale;
}

export function liveTextSize(role: LiveTextRole, height: number, textScale: number, width?: number, profile: LiveTextProfile = "projector"): {natural: number; effective: number} {
    const {k} = liveTextRoles[role];
    const natural = Math.round(liveUnit(height, textScale, width) * k * 10) / 10;
    return {natural, effective: Math.max(liveTextFloors[profile][role], natural)};
}

// CSS custom properties for .live-canvas: u follows the canvas (a size
// container) — its height, capped by its width as in liveUnit — so the
// full-window screen and the fixed LED area both scale.
export function liveTextVars(textScale: number, profile: LiveTextProfile = "projector"): Record<string, string> {
    const vars: Record<string, string> = {"--live-u": `calc(min(100cqh, 100cqw * 9 / 16) / 36 * ${textScale})`};
    for (const [role, {k}] of Object.entries(liveTextRoles)) vars[`--live-fs-${role}`] = `max(${liveTextFloors[profile][role as LiveTextRole]}px, calc(var(--live-u) * ${k}))`;
    return vars;
}

const widgetRoles: Record<LiveWidget["type"], LiveTextRole[]> = {
    // Title, timer and clock size themselves to the widget (liveFit); their
    // warnings come from the fit, not from the role floors.
    title: [], timer: [], chart: ["caption"], table: ["body", "caption"],
    ad_table: [], logos: ["caption"], solves: ["body", "caption"], announcement: ["display"], qr: ["caption"],
    podium: ["body", "caption"], facts: ["caption"], stages: ["body", "caption"], clock: [],
};

// «Розмір тексту» of a block (K3): S / M / L / XL multiply the screen unit of
// that block. The floors stay: a smaller size never reads below them.
export const liveTextSizes = {s: 0.85, m: 1, l: 1.2, xl: 1.45} as const;
export type LiveTextSizeKey = keyof typeof liveTextSizes;

// Blocks that fill their box (title, timer, clock) size by the box itself.
export function liveTextSized(type: LiveWidget["type"]): boolean {
    return widgetRoles[type].length > 0;
}

export function liveWidgetTextSize(widget: LiveWidget): LiveTextSizeKey {
    const value = widget.props.textSize;
    return liveTextSized(widget.type) && typeof value === "string" && value in liveTextSizes ? value as LiveTextSizeKey : "m";
}

// The text scale a block renders with: the screen scale × its own size.
export function liveWidgetTextScale(textScale: number, widget: LiveWidget): number {
    return textScale * liveTextSizes[liveWidgetTextSize(widget)];
}

// Blocks with a caption over their content, and whether it shows (K4):
// on by default, except the facts and the podium.
const captioned = new Set<LiveWidget["type"]>(["chart", "table", "solves", "logos", "stages", "facts", "podium"]);
export function liveHasCaption(type: LiveWidget["type"]): boolean {
    return captioned.has(type);
}
export function liveCaptionShown(widget: LiveWidget): boolean {
    if (!captioned.has(widget.type)) return false;
    if (typeof widget.props.showCaption === "boolean") return widget.props.showCaption;
    return widget.type !== "facts" && widget.type !== "podium";
}

// The caption text: the own one, else the block's default.
export function liveCaptionText(widget: LiveWidget, fallback: string): string {
    const own = widget.type === "logos" ? widget.props.title : widget.props.caption;
    return typeof own === "string" && own.trim() ? own.trim() : fallback;
}

// «fit»: the content does not fit the block (a real problem); «floor»: the
// natural size is under the profile floor and the screen raises it (a note,
// common on 720p, where every block reads at the floors).
export type LiveTextWarning = {id: string; text: string; kind: "fit" | "floor"};

// The widget's inner box on the real screen, in screen pixels (the widget
// padding is --live-pad).
export function liveWidgetBox(layout: LiveLayout, item: LiveWidget): {width: number; height: number} {
    const {width, height} = liveCanvasSize(layout);
    // The padding follows the screen, not the block's text size.
    const pad = Math.max(6, liveUnit(height, layout.screen.textScale, width) * 0.4);
    return {width: item.w * width / layout.grid.cols - 2 * pad, height: item.h * height / layout.grid.rows - 2 * pad};
}

// Rows of a table or recent-solves widget on the real screen: the same rule
// the screen renders with.
export function liveListFit(layout: LiveLayout, item: LiveWidget): LiveListGeometry & {rows: number} {
    const textScale = liveWidgetTextScale(layout.screen.textScale, item);
    const {height, width} = liveCanvasSize(layout);
    const profile = liveTextProfile(layout.screen);
    const rows = item.type === "table" ? numberProp(item, "rowsPerPage", 10) : numberProp(item, "rows", 5);
    const geometry = liveListGeometry({height: liveWidgetBox(layout, item).height, caption: liveTextSize("caption", height, textScale, width, profile).effective,
        body: liveTextSize("body", height, textScale, width, profile).effective, rows, header: item.type === "table", captionShown: liveCaptionShown(item)});
    return {...geometry, rows};
}

function numberProp(item: LiveWidget, key: string, fallback: number): number {
    const value = Number(item.props[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Small-text and fit warnings for the chosen screen size: a role whose
// natural size falls under its floor is raised to the floor on screen, and a
// widget whose content no longer fits at the effective sizes is named.
// `eventName` is the real event name the title must fit.
// `stages` are the event's stages the «Етапи» block lists (sample ones when
// there are none, as the editor shows).
export function liveTextWarnings(layout: LiveLayout, eventName = t("live.text.sampleTitle"), stages: LiveStage[] = []): LiveTextWarning[] {
    const {height, width} = liveCanvasSize(layout);
    const profile = liveTextProfile(layout.screen);
    const floors = liveTextFloors[profile];
    const warnings: LiveTextWarning[] = [];
    for (const item of layout.widgets) {
        if (item.type === "ad_table") continue;
        const textScale = liveWidgetTextScale(layout.screen.textScale, item);
        const size = (role: LiveTextRole) => liveTextSize(role, height, textScale, width, profile);
        const heading = liveCaptionShown(item) ? size("caption").effective * 1.2 + size("caption").effective * 0.5 : 0;
        const name = liveWidgetName(item);
        const low = widgetRoles[item.type].filter(role => size(role).natural < floors[role]);
        if (low.length) {
            warnings.push({id: item.id, kind: "floor", text: t("live.text.warning", {name, problem: t("live.text.belowFloor", {
                sizes: low.map(role => t("live.text.roleSize", {role: liveTextRoles[role].label, size: Math.floor(size(role).natural)})).join(", "),
                floors: low.map(role => t("live.text.px", {size: floors[role]})).join(" / "),
            })})});
        }
        const box = liveWidgetBox(layout, item);
        const fit = item.type === "table" || item.type === "solves" ? listProblem(liveListFit(layout, item))
            : item.type === "stages" ? stagesProblem(item, box, size, stages)
                : fitProblem(item, box.width, box.height, heading, size, floors, eventName);
        if (fit) warnings.push({id: item.id, kind: "fit", text: t("live.text.warning", {name, problem: fit})});
    }
    return warnings;
}

// «Етапи»: one two-line row per stage, by the same rule the block renders
// with; the time line keeps the caption floor, the name the body floor.
function stagesProblem(item: LiveWidget, box: {width: number; height: number}, size: (role: LiveTextRole) => {effective: number}, stages: LiveStage[]): string | null {
    const shown = stages.length ? stages : liveSampleStages(new Date(0).toISOString());
    const caption = size("caption").effective, body = size("body").effective;
    const geometry = liveListGeometry({height: box.height, caption, body, rows: shown.length, header: false, captionShown: liveCaptionShown(item)});
    const fit = liveTwoLineRow({rowHeight: geometry.rowHeight, width: box.width, chars: liveStageNameChars(shown), body, caption});
    return fit.readable ? null : t("live.text.stagesFit", {count: shown.length});
}

function logoRows(item: LiveWidget): number {
    const rows = Number(item.props.rows);
    return item.props.mode !== "carousel" && [1, 2, 3].includes(rows) ? rows : 1;
}

function listProblem(fit: LiveListGeometry & {rows: number}): string | null {
    return fit.readable ? null : t("live.text.rowsFit", {rows: fit.rows, max: fit.maxRows});
}

function fitProblem(item: LiveWidget, boxW: number, boxH: number, heading: number, size: (role: LiveTextRole) => {effective: number}, floors: Record<LiveTextRole, number>, eventName: string): string | null {
    const caption = size("caption").effective;
    const body = size("body").effective;
    if (item.type === "title") {
        const subtitle = typeof item.props.subtitle === "string" && !!item.props.subtitle.trim() || item.props.subtitleStage === true;
        const fit = liveTitleFit({width: boxW, height: boxH, name: eventName, subtitle, logo: true, subtitleMin: floors.caption});
        return fit.name < floors.display ? t("live.text.titleFit") : null;
    }
    if (item.type === "announcement") {
        return boxH < size("display").effective * 1.15 ? t("live.text.titleFit") : null;
    }
    if (item.type === "timer") {
        const label = item.props.showLabel === false ? null : typeof item.props.label === "string" && item.props.label.trim() ? item.props.label.trim() : t("live.timer.untilFinish");
        const labelSize = (["s", "m", "l"] as const).find(value => value === item.props.labelSize) ?? "m";
        // The widest line the format prints: «23 год 59 хв» in words, HH:MM(:SS) otherwise.
        const digits = item.props.digits === "words" ? 12 : item.props.showSeconds === false ? 5 : 8;
        const fit = liveTimerFit({width: boxW, height: boxH, digits, label, labelSize, labelMin: floors.caption});
        return fit.digits < floors.timer || label !== null && fit.label < floors.caption ? t("live.text.timerFit") : null;
    }
    if (item.type === "chart") {
        const lines = Math.min(20, numberProp(item, "lines", 5));
        return boxH - heading - caption * 1.6 < lines * caption * 1.25 ? t("live.text.chartFit", {lines}) : null;
    }
    if (item.type === "logos") return boxH - heading < 24 * logoRows(item) ? t("live.text.logosFit") : null;
    if (item.type === "clock") {
        const label = typeof item.props.label === "string" && item.props.label.trim() ? item.props.label.trim() : null;
        const fit = liveTimerFit({width: boxW, height: boxH, digits: item.props.showSeconds === true ? 8 : 5, label, labelSize: "m", labelMin: floors.caption});
        return fit.digits < floors.timer ? t("live.text.timerFit") : null;
    }
    if (item.type === "podium" && item.props.variant === "cards") {
        const box = liveCardsBox(boxW, boxH - heading);
        const fit = liveCardsFit({width: box.width, height: box.height, names: [t("live.text.sampleTeam"), t("live.text.sampleTeam"), t("live.text.sampleTeam")],
            pointsChars: 5, ring: item.props.showRing === true, body, caption});
        return fit.readable ? null : t("live.text.podiumFit");
    }
    if (item.type === "podium") {
        const fit = livePodiumFit({width: boxW, height: boxH - heading, names: [t("live.text.sampleTeam"), t("live.text.sampleTeam"), t("live.text.sampleTeam")], body, caption});
        return fit.readable ? null : t("live.text.podiumFit");
    }
    if (item.type === "facts") {
        const fit = liveFactsFit({width: boxW, height: boxH - heading, items: liveFactItems(item).map(() => ({value: 5, label: 8})), display: size("display").effective, caption});
        return fit.readable ? null : t("live.text.factsFit");
    }
    if (item.type === "qr") return Math.min(boxW, boxH - caption * 1.3) < 80 ? t("live.text.qrFit") : null;
    return null;
}
