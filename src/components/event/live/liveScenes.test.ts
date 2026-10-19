import {describe, expect, it} from "vitest";
import {defaultLiveLayout, type LiveLayout} from "@/api/manageLive";
import {liveSampleResults} from "./liveSample";
import {liveWidgetLimit, liveWidgetsTotal, liveSceneLayout, liveSceneOwn, liveScenePreviewNow, liveScenePreviewResults, liveSceneShown, liveSceneState, liveSceneViews, mapLiveScenes, withLiveScene, withLiveSceneOwn} from "./liveScenes";

const hour = 3600_000;
const start = Date.parse("2026-10-20T08:00:00Z");
const event = {StartTime: new Date(start).toISOString(), FinishTime: new Date(start + 8 * hour).toISOString()};
const calm = {Active: false, Applied: false};
const frozen = {Active: true, Applied: true};

describe("liveSceneState: the event state picks the scene", () => {
    it("goes before → running → frozen → finished by the clock and the freeze", () => {
        expect(liveSceneState(event, calm, start - 1)).toBe("before");
        expect(liveSceneState(event, calm, start)).toBe("running");
        expect(liveSceneState(event, frozen, start + 7 * hour)).toBe("frozen");
        expect(liveSceneState(event, calm, start + 8 * hour)).toBe("finished");
    });

    it("lets the finish win over a freeze that is still applied", () => {
        expect(liveSceneState(event, frozen, start + 9 * hour)).toBe("finished");
    });

    it("stays on the running board while the hall sees live results during the freeze", () => {
        expect(liveSceneState(event, {Active: true, Applied: false}, start + 7 * hour)).toBe("running");
    });

    it("never finishes an event without a finish time", () => {
        expect(liveSceneState({...event, FinishTime: null}, undefined, start + 100 * hour)).toBe("running");
    });
});

describe("scenes of a layout", () => {
    const single: LiveLayout = {...defaultLiveLayout, scenes: undefined};

    it("chains «Перед стартом» → board → «Підсумки» by default, the freeze showing the board", () => {
        expect(liveSceneShown(defaultLiveLayout, "before")).toBe("before");
        expect(liveSceneShown(defaultLiveLayout, "running")).toBe("running");
        expect(liveSceneShown(defaultLiveLayout, "frozen")).toBe("running");
        expect(liveSceneShown(defaultLiveLayout, "finished")).toBe("finished");
        expect(liveSceneLayout(defaultLiveLayout, "before").widgets.some(widget => widget.type === "facts")).toBe(true);
        expect(liveSceneLayout(defaultLiveLayout, "finished").widgets.some(widget => widget.type === "podium")).toBe(true);
    });

    it("shows the running board in every state of a layout without scenes", () => {
        for (const state of ["before", "running", "frozen", "finished"] as const) expect(liveSceneShown(single, state)).toBe("running");
    });

    it("keeps the screen settings shared while each scene keeps its canvas", () => {
        const before = liveSceneLayout(defaultLiveLayout, "before");
        const next = withLiveScene(defaultLiveLayout, "before", {...before, theme: "light", grid: {cols: 16, rows: 9}});
        expect(next.theme).toBe("light");
        expect(next.grid).toEqual(defaultLiveLayout.grid);
        expect(next.scenes?.before?.grid).toEqual({cols: 16, rows: 9});
        expect(liveSceneLayout(next, "finished").theme).toBe("light");
    });

    it("starts an own scene as a copy of the board and drops it back", () => {
        const own = withLiveSceneOwn(single, "frozen", true);
        expect(liveSceneOwn(own, "frozen")).toBe(true);
        expect(liveSceneLayout(own, "frozen").widgets).toEqual(single.widgets);
        const back = withLiveSceneOwn(own, "frozen", false);
        expect(liveSceneOwn(back, "frozen")).toBe(false);
        expect(back.scenes).toBeUndefined();
    });

    it("lists and maps every scene in the order of the event", () => {
        expect(liveSceneViews(defaultLiveLayout).map(item => item.key)).toEqual(["before", "running", "finished"]);
        const cleared = mapLiveScenes(defaultLiveLayout, view => ({...view, widgets: []}));
        expect(liveSceneViews(cleared).every(item => item.view.widgets.length === 0)).toBe(true);
    });
});

describe("the editor preview of a scene", () => {
    it("moves the clock into the scene's state unless it is there already", () => {
        const running = start + 2 * hour;
        expect(liveScenePreviewNow("before", event, running)).toBe(start - 15 * 60_000);
        expect(liveScenePreviewNow("before", event, start - hour)).toBe(start - hour);
        expect(liveScenePreviewNow("running", event, running)).toBe(running);
        expect(liveScenePreviewNow("running", event, start - hour)).toBe(start + hour);
        expect(liveScenePreviewNow("finished", event, running)).toBe(start + 8 * hour + 60_000);
        expect(liveScenePreviewNow("frozen", event, start + 9 * hour)).toBe(start + hour);
    });

    it("shows frozen results in the frozen scene only", () => {
        const results = liveSampleResults(start + hour);
        expect(liveScenePreviewResults("running", results, start + hour)).toBe(results);
        const preview = liveScenePreviewResults("frozen", results, start + hour);
        expect(preview?.Freeze.Applied).toBe(true);
        expect(preview?.Freeze.FrozenAt).toBe(new Date(start + hour - 10 * 60_000).toISOString());
    });
});

describe("widget limits of the daemon", () => {
    const qr = (count: number) => Array.from({length: count}, (_, index) => ({id: `q${index}`, type: "qr" as const, x: index % 12 + 1, y: Math.floor(index / 12) + 1, w: 1, h: 1, props: {}}));
    it("allows 48 widgets on a scene and 96 in all scenes", () => {
        const layout: LiveLayout = {...defaultLiveLayout, widgets: qr(47), scenes: {before: {grid: {cols: 12, rows: 8}, widgets: qr(48)}}};
        expect(liveWidgetsTotal(layout)).toBe(95);
        expect(liveWidgetLimit(layout, "running")).toBeNull();
        expect(liveWidgetLimit(layout, "before")).toBe("scene");
        expect(liveWidgetLimit({...layout, widgets: qr(48), scenes: {...layout.scenes, finished: {grid: {cols: 12, rows: 8}, widgets: []}}}, "finished")).toBe("total");
    });
});

