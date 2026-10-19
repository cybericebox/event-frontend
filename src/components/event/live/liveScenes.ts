import type {LiveLayout, LiveScene} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";

// Event states and their screens (LIVE-CONSTRUCTOR §6.4). «Один екран для
// всіх станів» (no `scenes`): the layout is shown in every state. «Окремий
// екран для кожного стану»: «before», «frozen» and «finished» have their own
// screen (grid, widgets, screen shapes) next to the layout itself, which is
// «running». The screen settings — theme, aspect, screen, refresh — are
// shared by all states.
export const liveSceneKeys = ["before", "running", "frozen", "finished"] as const;
export type LiveSceneKey = typeof liveSceneKeys[number];

type Freeze = Pick<ManageResultsSnapshot["Freeze"], "Active" | "Applied"> | undefined;

// «Заморожено» follows the frozen results the hall sees: with «Враховувати
// заморожування» off the screen shows live results during the freeze period,
// so it stays on «Триває». (Owner default 2026-10-19; set to false to switch
// the scene for the whole freeze period instead.)
const frozenSceneOnlyWhenApplied = true;

// The event state at `now`: before the start, after the finish, while the
// results are frozen, or running. The finish wins over the freeze.
export function liveSceneState(event: Pick<PublicEventInfo, "StartTime" | "FinishTime">, freeze: Freeze, now: number): LiveSceneKey {
    if (now < Date.parse(event.StartTime)) return "before";
    if (event.FinishTime && now >= Date.parse(event.FinishTime)) return "finished";
    if (freeze?.Applied || !frozenSceneOnlyWhenApplied && freeze?.Active) return "frozen";
    return "running";
}

// One scene as a whole layout, ready for the canvas, the formats and the
// editor: the shared screen settings with the scene's grid and widgets.
export function liveSceneLayout(layout: LiveLayout, key: LiveSceneKey): LiveLayout {
    const scene = key === "running" ? undefined : layout.scenes?.[key];
    if (!scene) return layout;
    return {...layout, grid: scene.grid, widgets: scene.widgets, formats: scene.formats};
}

export type LiveSceneMode = "single" | "separate";

export function liveSceneMode(layout: LiveLayout): LiveSceneMode {
    return layout.scenes ? "separate" : "single";
}

// To separate screens: every state starts as a copy of the one screen. Back
// to one screen: the screen of `keep` becomes the one for all states.
export function withLiveSceneMode(layout: LiveLayout, mode: LiveSceneMode, keep: LiveSceneKey = "running"): LiveLayout {
    if (mode === "separate") {
        if (layout.scenes) return layout;
        const copy = sceneOf(layout);
        return {...layout, scenes: {before: copy, frozen: copy, finished: copy}};
    }
    const kept = liveSceneLayout(layout, keep);
    return {...layout, grid: kept.grid, widgets: kept.widgets, formats: kept.formats, scenes: undefined};
}

// «Скопіювати з…»: the screen of `source` replaces the screen of `target`.
export function withLiveSceneCopy(layout: LiveLayout, target: LiveSceneKey, source: LiveSceneKey): LiveLayout {
    const from = liveSceneLayout(layout, source);
    return withLiveScene(layout, target, {...liveSceneLayout(layout, target), grid: from.grid, widgets: from.widgets, formats: from.formats});
}

// Whether two states show the same screen (no change to lose on a copy).
export function liveScenesEqual(layout: LiveLayout, a: LiveSceneKey, b: LiveSceneKey): boolean {
    return JSON.stringify(sceneOf(liveSceneLayout(layout, a))) === JSON.stringify(sceneOf(liveSceneLayout(layout, b)));
}

function sceneOf(view: LiveLayout): LiveScene {
    return view.formats ? {grid: view.grid, widgets: view.widgets, formats: view.formats} : {grid: view.grid, widgets: view.widgets};
}

// Stores an edited scene view back: its canvas into the scene, its screen
// settings into the whole layout.
export function withLiveScene(layout: LiveLayout, key: LiveSceneKey, view: LiveLayout): LiveLayout {
    const shared = {...layout, theme: view.theme, aspect: view.aspect, screen: view.screen, refreshSeconds: view.refreshSeconds};
    if (key === "running") return {...shared, grid: view.grid, widgets: view.widgets, formats: view.formats};
    return {...shared, scenes: {...layout.scenes, [key]: sceneOf(view)}};
}

// Every scene's canvas, the running one first: for checks that look at all
// of them (conflicts, formats, validation).
export function liveSceneViews(layout: LiveLayout): {key: LiveSceneKey; view: LiveLayout}[] {
    return (layout.scenes ? liveSceneKeys : ["running" as const]).map(key => ({key, view: liveSceneLayout(layout, key)}));
}

// The editor preview of a scene: a moment of that state, so the timer, the
// stage and the freeze badge read as they will. Real time is kept when it is
// already in the state; otherwise 15 minutes before the start, an hour into
// the event (or its middle), or a minute after the finish.
export function liveScenePreviewNow(key: LiveSceneKey, event: Pick<PublicEventInfo, "StartTime" | "FinishTime">, now: number): number {
    const start = Date.parse(event.StartTime);
    const finish = event.FinishTime ? Date.parse(event.FinishTime) : null;
    const running = (at: number) => at >= start && (finish === null || at < finish);
    if (key === "before") return now < start ? now : start - 15 * 60_000;
    if (key === "finished") return finish === null ? now : now >= finish ? now : finish + 60_000;
    if (running(now)) return now;
    return finish === null ? start + 60 * 60_000 : Math.min(start + 60 * 60_000, start + (finish - start) / 2);
}

// The preview of «Заморожено» shows frozen results (frozen ten minutes before
// the preview moment) when the real ones are not.
export function liveScenePreviewResults(key: LiveSceneKey, results: ManageResultsSnapshot | undefined, now: number): ManageResultsSnapshot | undefined {
    if (key !== "frozen" || !results || results.Freeze.Applied) return results;
    const frozenAt = new Date(now - 10 * 60_000).toISOString();
    return {...results, Freeze: {...results.Freeze, Enabled: true, Active: true, Applied: true, FrozenAt: frozenAt}};
}

// Applies `change` to every scene's canvas (a check or a clean-up that each
// scene needs, such as dropping a shape that became the base aspect).
export function mapLiveScenes(layout: LiveLayout, change: (view: LiveLayout, key: LiveSceneKey) => LiveLayout): LiveLayout {
    let next = layout;
    for (const {key, view} of liveSceneViews(layout)) next = withLiveScene(next, key, change(view, key));
    return next;
}

// The daemon limits: 48 widgets on one scene, 96 in all scenes together.
export const liveWidgetLimits = {scene: 48, total: 96} as const;

export function liveWidgetsTotal(layout: LiveLayout): number {
    return liveSceneViews(layout).reduce((sum, {view}) => sum + view.widgets.length, 0);
}

// Why `add` more widgets cannot go onto `scene`, or null when they can.
export function liveWidgetLimit(layout: LiveLayout, scene: LiveSceneKey, add = 1): "scene" | "total" | null {
    if (liveSceneLayout(layout, scene).widgets.length + add > liveWidgetLimits.scene) return "scene";
    if (liveWidgetsTotal(layout) + add > liveWidgetLimits.total) return "total";
    return null;
}
