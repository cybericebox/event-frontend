import {liveSceneTemplate, type LiveLayout, type LiveScene} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";

// Scenes (LIVE-CONSTRUCTOR §6.4): one canvas per event state, each its own.
// The layout itself is «running»; «before», «frozen» and «finished» have
// their own canvas (grid, widgets, screen shapes), filled from the scene
// templates on load when missing. The screen settings — theme, aspect,
// screen, refresh — are shared by all scenes.
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
    if (key === "running") return layout;
    const scene = layout.scenes?.[key] ?? liveSceneTemplate(layout, key);
    return {...layout, grid: scene.grid, widgets: scene.widgets, formats: scene.formats};
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

// «Скинути до шаблону сцени»: the scene's canvas goes back to its template
// (its own shapes too).
export function withLiveSceneReset(layout: LiveLayout, key: LiveSceneKey): LiveLayout {
    const template = liveSceneTemplate(layout, key);
    return withLiveScene(layout, key, {...liveSceneLayout(layout, key), grid: template.grid, widgets: template.widgets, formats: undefined});
}

// Every scene's canvas, the running one first: for checks that look at all
// of them (conflicts, formats, validation).
export function liveSceneViews(layout: LiveLayout): {key: LiveSceneKey; view: LiveLayout}[] {
    return liveSceneKeys.map(key => ({key, view: liveSceneLayout(layout, key)}));
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
