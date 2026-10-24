import type {LiveLayout, LiveScene, LiveWidget} from "@/api/manageLive";
import {t} from "@/i18n/t";
import {liveSceneLayout, withLiveScene, type LiveSceneKey} from "./liveScenes";

// Ready screens (LIVE-CONSTRUCTOR §4), made for 1280×720 on a 12×8 grid: the
// text floors of a projector hold in every block. A template fills one scene;
// «Повний показ» fills the chain «Перед стартом» → «Табло і таймер» →
// «Підсумки» at once.

function widget(type: LiveWidget["type"], x: number, y: number, w: number, h: number, props: LiveWidget["props"] = {}): LiveWidget {
    return {id: crypto.randomUUID(), type, x, y, w, h, props};
}

const grid = {cols: 12, rows: 8};
const canvas = (widgets: LiveWidget[]): LiveScene => ({grid, widgets});
const organizers = (x = 1, y = 8, w = 3, h = 1, props: LiveWidget["props"] = {}) => widget("logos", x, y, w, h, {mode: "fixed", title: t("live.preset.organizers"), ...props});
const partners = (x = 4, y = 8, w = 9, h = 1, props: LiveWidget["props"] = {}) => widget("logos", x, y, w, h, {mode: "carousel", title: t("live.preset.partners"), ...props});

const scenes = {
    classic: () => canvas([widget("title", 1, 1, 9, 1), widget("timer", 10, 1, 3, 1), widget("chart", 1, 2, 8, 6), widget("table", 9, 2, 4, 6), organizers(), partners()]),
    scoreboard: () => canvas([
        widget("title", 1, 1, 8, 1, {subtitleStage: true}), widget("timer", 9, 1, 4, 2, {lastMinutes: 5}),
        widget("table", 1, 2, 8, 6, {pinTop: 3, rowsPerPage: 10}), widget("solves", 9, 3, 4, 5, {mode: "first", rows: 5}),
        organizers(), partners(),
    ]),
    bigboard: () => canvas([
        widget("title", 1, 1, 9, 1), widget("timer", 10, 1, 3, 1),
        widget("table", 1, 2, 12, 6, {columns: 2, pinTop: 3, rowsPerPage: 10}),
        organizers(), partners(),
    ]),
    stage: () => canvas([
        widget("title", 1, 1, 9, 1, {subtitleStage: true}), widget("timer", 10, 1, 3, 1, {source: "stage-end"}),
        widget("stages", 1, 2, 4, 6), widget("chart", 5, 2, 8, 6),
        organizers(), partners(),
    ]),
    prestart: () => canvas([
        widget("title", 1, 1, 8, 2, {subtitleStage: true}), widget("timer", 1, 3, 8, 3, {align: "left"}),
        widget("facts", 1, 6, 8, 2, {items: ["teams", "tasks", "start"]}),
        widget("qr", 9, 1, 4, 7, {value: "/", caption: t("live.template.qrCaption")}),
        organizers(), partners(),
    ]),
    finale: () => canvas([
        widget("title", 1, 1, 9, 1, {subtitle: t("live.template.finaleSubtitle")}), widget("timer", 10, 1, 3, 1),
        widget("podium", 1, 2, 12, 3), widget("table", 1, 5, 12, 3, {columns: 2, offset: 3, limit: 8, rowsPerPage: 4, showCaption: false}),
        organizers(), partners(),
    ]),
    // Three leader cards over the list: the list starts after them, or shows everyone.
    leaders: () => canvas([
        widget("title", 1, 1, 9, 1, {subtitleStage: true}), widget("timer", 10, 1, 3, 1),
        widget("podium", 1, 2, 12, 3, {variant: "cards", showRing: true, highlightTop: "medals"}),
        widget("table", 1, 5, 12, 3, {columns: 2, offset: 3, rowsPerPage: 4, showBars: true, showCaption: false}),
        organizers(), partners(),
    ]),
    leadersAll: () => canvas([
        widget("title", 1, 1, 9, 1, {subtitleStage: true}), widget("timer", 10, 1, 3, 1),
        widget("podium", 1, 2, 12, 3, {variant: "cards", showRing: true, highlightTop: "medals"}),
        widget("table", 1, 5, 12, 3, {columns: 2, pinTop: 0, rowsPerPage: 4, showBars: true, highlightTop: "medals", showCaption: false}),
        organizers(), partners(),
    ]),
    // The leaders with a points and a flags ring, everyone below with a
    // «1600/2100» bar and a flag per task.
    progress: () => canvas([
        widget("title", 1, 1, 9, 1, {subtitleStage: true}), widget("timer", 10, 1, 3, 1),
        widget("podium", 1, 2, 12, 3, {variant: "cards", showRing: true, showFlagsRing: true, showPoints: false, highlightTop: "medals"}),
        widget("table", 1, 5, 12, 3, {pinTop: 0, rowsPerPage: 4, showBars: true, barsAt: "points", showFlags: true, showInitials: true, highlightTop: "medals", showCaption: false}),
        organizers(), partners(),
    ]),
    // The leaders as a column of cards on the left, the rest of the table on the right.
    leadersSide: () => canvas([
        widget("title", 1, 1, 9, 1, {subtitleStage: true}), widget("timer", 10, 1, 3, 1),
        widget("podium", 1, 2, 5, 6, {variant: "cards", marker: "cups", highlightTop: "medals", showCaption: false}),
        widget("table", 6, 2, 7, 6, {offset: 3, rowsPerPage: 10, showBars: true}),
        organizers(), partners(),
    ]),
    // A board for a long event: the table, the first solves and the numbers.
    boardEvents: () => canvas([
        widget("title", 1, 1, 9, 1, {subtitleStage: true}), widget("timer", 10, 1, 3, 1),
        widget("table", 1, 2, 7, 6, {marker: "medal-icons", highlightTop: "medals", showBars: true, rowsPerPage: 10}),
        widget("solves", 8, 2, 5, 3, {mode: "first", rows: 4}),
        widget("facts", 8, 5, 5, 3, {items: ["teams", "tasks", "solves", "firstBlood"]}),
        organizers(), partners(),
    ]),
    // The award ceremony: the podium with cups (or the organizer's pictures) and places 4+.
    ceremony: () => canvas([
        widget("title", 1, 1, 12, 1, {subtitle: t("live.template.finaleSubtitle"), align: "center"}),
        widget("podium", 2, 2, 10, 3, {marker: "cups", highlightTop: "medals", showCaption: false}),
        widget("table", 1, 5, 12, 3, {columns: 2, offset: 3, limit: 6, rowsPerPage: 3, showCaption: false}),
        organizers(), partners(),
    ]),
    // A narrow side panel (timer, QR, logos) next to a tall table, under the title.
    sidePanel: () => canvas([
        widget("title", 1, 1, 12, 1), widget("timer", 1, 2, 4, 2, {align: "left"}),
        widget("qr", 1, 4, 4, 3, {value: "/", caption: t("live.template.qrCaption")}),
        widget("logos", 1, 7, 4, 2, {mode: "fixed", rows: 2, title: t("live.preset.partners")}),
        widget("table", 5, 2, 8, 7, {marker: "cups", highlightTop: "medals", showBars: true, rowsPerPage: 11}),
    ]),
    break: () => canvas([
        widget("title", 1, 1, 6, 1), widget("clock", 7, 1, 3, 1, {label: t("live.template.clockLabel")}), widget("timer", 10, 1, 3, 1),
        widget("announcement", 1, 2, 12, 2, {text: t("live.template.breakText")}),
        organizers(1, 4, 12, 2), partners(1, 6, 10, 3, {mode: "fixed", rows: 2}),
        widget("qr", 11, 6, 2, 3, {value: "/", caption: t("live.template.qrShort")}),
    ]),
    empty: () => canvas([]),
} satisfies Record<string, () => LiveScene>;
type LiveSceneTemplate = keyof typeof scenes;

export type LiveTemplate = {
    label: string; description: string;
    // The state the template is made for; «all» fills every scene.
    scene: LiveSceneKey | "all";
    // The canvas per scene it sets; a single-scene template sets the scene
    // being edited.
    build: () => Partial<Record<LiveSceneKey, LiveScene>>;
};

const single = (key: LiveSceneTemplate, scene: LiveSceneKey): LiveTemplate => ({
    label: t(`live.template.${key}`), description: t(`live.template.${key}Description`), scene, build: () => ({[scene]: scenes[key]()}),
});

export const liveTemplates = {
    show: {label: t("live.template.show"), description: t("live.template.showDescription"), scene: "all", build: () => ({before: scenes.prestart(), running: scenes.scoreboard(), finished: scenes.finale()})},
    scoreboard: single("scoreboard", "running"),
    bigboard: single("bigboard", "running"),
    leaders: single("leaders", "running"),
    leadersAll: single("leadersAll", "running"),
    progress: single("progress", "running"),
    leadersSide: single("leadersSide", "running"),
    boardEvents: single("boardEvents", "running"),
    stage: single("stage", "running"),
    ceremony: single("ceremony", "finished"),
    sidePanel: single("sidePanel", "running"),
    prestart: single("prestart", "before"),
    finale: single("finale", "finished"),
    break: single("break", "running"),
    classic: single("classic", "running"),
    empty: single("empty", "running"),
} satisfies Record<string, LiveTemplate>;
export type LiveTemplateKey = keyof typeof liveTemplates;

// Applies a template: «Повний показ» replaces every scene («Заморожено»
// gets a copy of the board); any other one replaces the canvas of `scene`, the
// scene being edited. Screen settings stay; custom shapes of a replaced
// canvas are dropped, as their placements belong to the old widgets.
export function applyLiveTemplate(layout: LiveLayout, key: LiveTemplateKey, scene: LiveSceneKey): LiveLayout {
    const template: LiveTemplate = liveTemplates[key];
    const built = template.build();
    if (template.scene === "all") {
        const running = built.running ?? scenes.classic();
        const next: LiveLayout = {...layout, grid: running.grid, widgets: running.widgets, formats: undefined, scenes: {}};
        const frozen = {grid: running.grid, widgets: running.widgets.map(item => ({...item, id: crypto.randomUUID()}))};
        return {...next, scenes: {before: built.before ?? scenes.prestart(), frozen: built.frozen ?? frozen, finished: built.finished ?? scenes.finale()}};
    }
    const canvasOf = Object.values(built)[0] ?? scenes.empty();
    return withLiveScene(layout, scene, {...liveSceneLayout(layout, scene), grid: canvasOf.grid, widgets: canvasOf.widgets, formats: undefined});
}

// The canvas a template card shows: its own scene, or «running» for the show.
export function liveTemplatePreview(layout: LiveLayout, key: LiveTemplateKey): LiveLayout {
    const template: LiveTemplate = liveTemplates[key];
    const built = template.build();
    const scene = template.scene === "all" ? "running" : template.scene;
    const canvasOf = built[scene] ?? scenes.empty();
    return {...layout, grid: canvasOf.grid, widgets: canvasOf.widgets, formats: undefined, scenes: undefined};
}
