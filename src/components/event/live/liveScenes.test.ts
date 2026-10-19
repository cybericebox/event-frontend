import {describe, expect, it} from "vitest";
import {defaultLiveLayout, liveLayoutSchema, type LiveLayout} from "@/api/manageLive";
import {liveSampleResults} from "./liveSample";
import {liveSceneLayout, liveSceneMode, liveScenePreviewNow, liveScenePreviewResults, liveScenesEqual, liveSceneState, liveSceneViews, liveWidgetLimit, liveWidgetsTotal, mapLiveScenes, withLiveScene, withLiveSceneCopy, withLiveSceneMode} from "./liveScenes";

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

    it("shows one screen for all states by default", () => {
        expect(liveSceneMode(defaultLiveLayout)).toBe("single");
        for (const state of ["before", "running", "frozen", "finished"] as const) expect(liveSceneLayout(defaultLiveLayout, state)).toBe(defaultLiveLayout);
        expect(liveSceneViews(defaultLiveLayout).map(item => item.key)).toEqual(["running"]);
    });

    it("turns to separate screens as copies of the one screen, and back keeping the chosen state's", () => {
        const separate = withLiveSceneMode(defaultLiveLayout, "separate");
        expect(liveSceneMode(separate)).toBe("separate");
        for (const state of ["before", "frozen", "finished"] as const) expect(liveSceneLayout(separate, state).widgets).toEqual(defaultLiveLayout.widgets);
        const edited = withLiveScene(separate, "finished", {...liveSceneLayout(separate, "finished"), widgets: []});
        const back = withLiveSceneMode(edited, "single", "finished");
        expect(liveSceneMode(back)).toBe("single");
        expect(back.widgets).toEqual([]);
        expect(withLiveSceneMode(edited, "single", "running").widgets).toEqual(defaultLiveLayout.widgets);
    });

    it("copies the screen of another state", () => {
        const separate = withLiveSceneMode(defaultLiveLayout, "separate");
        const edited = withLiveScene(separate, "before", {...liveSceneLayout(separate, "before"), widgets: []});
        expect(liveScenesEqual(edited, "before", "running")).toBe(false);
        const copied = withLiveSceneCopy(edited, "before", "running");
        expect(liveScenesEqual(copied, "before", "running")).toBe(true);
        expect(liveSceneLayout(copied, "frozen").widgets).toEqual(defaultLiveLayout.widgets);
    });

    it("fills a state missing from stored separate screens with a copy of «running» on load", () => {
        const stored = JSON.parse(JSON.stringify({...defaultLiveLayout, scenes: {finished: {grid: {cols: 12, rows: 8}, widgets: []}}}));
        const loaded = liveLayoutSchema.parse(stored);
        expect(liveSceneLayout(loaded, "before").widgets).toEqual(defaultLiveLayout.widgets);
        expect(liveSceneLayout(loaded, "frozen").widgets).toEqual(defaultLiveLayout.widgets);
        expect(liveSceneLayout(loaded, "finished").widgets).toEqual([]);
        expect(liveLayoutSchema.parse(JSON.parse(JSON.stringify(defaultLiveLayout))).scenes).toBeUndefined();
    });

    it("keeps the screen settings shared while each scene keeps its canvas", () => {
        const separate = withLiveSceneMode(defaultLiveLayout, "separate");
        const before = liveSceneLayout(separate, "before");
        const next = withLiveScene(separate, "before", {...before, theme: "light", grid: {cols: 16, rows: 9}});
        expect(next.theme).toBe("light");
        expect(next.grid).toEqual(defaultLiveLayout.grid);
        expect(next.scenes?.before?.grid).toEqual({cols: 16, rows: 9});
        expect(liveSceneLayout(next, "finished").theme).toBe("light");
    });

    it("lists and maps every scene in the order of the event", () => {
        const separate = withLiveSceneMode(defaultLiveLayout, "separate");
        expect(liveSceneViews(separate).map(item => item.key)).toEqual(["before", "running", "frozen", "finished"]);
        const cleared = mapLiveScenes(separate, view => ({...view, widgets: []}));
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
        const empty = {grid: {cols: 12, rows: 8}, widgets: []};
        const layout: LiveLayout = {...defaultLiveLayout, widgets: qr(47), scenes: {before: {grid: {cols: 12, rows: 8}, widgets: qr(48)}, frozen: empty, finished: empty}};
        expect(liveWidgetsTotal(layout)).toBe(95);
        expect(liveWidgetLimit(layout, "running")).toBeNull();
        expect(liveWidgetLimit(layout, "before")).toBe("scene");
        expect(liveWidgetLimit({...layout, widgets: qr(48), scenes: {...layout.scenes, finished: {grid: {cols: 12, rows: 8}, widgets: []}}}, "finished")).toBe("total");
    });
});

