import {describe, expect, it} from "vitest";
import {defaultLiveLayout, liveLayoutSchema, type LiveLayout} from "@/api/manageLive";
import {liveSampleResults} from "./liveSample";
import {liveWidgetLimit, liveWidgetsTotal, liveSceneLayout, liveScenePreviewNow, liveScenePreviewResults, liveSceneState, liveSceneViews, mapLiveScenes, withLiveScene, withLiveSceneReset} from "./liveScenes";

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

    it("gives every state its own canvas by default: pre-start, the board, its copy for the freeze, the finale", () => {
        expect(Object.keys(defaultLiveLayout.scenes ?? {}).sort()).toEqual(["before", "finished", "frozen"]);
        expect(liveSceneLayout(defaultLiveLayout, "before").widgets.some(widget => widget.type === "facts")).toBe(true);
        expect(liveSceneLayout(defaultLiveLayout, "frozen").widgets.map(widget => widget.type)).toEqual(defaultLiveLayout.widgets.map(widget => widget.type));
        expect(liveSceneLayout(defaultLiveLayout, "finished").widgets.some(widget => widget.type === "podium")).toBe(true);
    });

    it("fills the missing scenes of a saved layout from their templates on load, the same way every time", () => {
        const saved = JSON.parse(JSON.stringify(single));
        const loaded = liveLayoutSchema.parse(saved);
        expect(Object.keys(loaded.scenes ?? {}).sort()).toEqual(["before", "finished", "frozen"]);
        expect(loaded.scenes?.frozen?.widgets.map(widget => widget.type)).toEqual(single.widgets.map(widget => widget.type));
        expect(loaded.scenes?.frozen?.widgets.every(widget => widget.id.startsWith("frozen-"))).toBe(true);
        expect(liveLayoutSchema.parse(saved)).toEqual(loaded);
        // A scene the organizer made stays as it is.
        const own = liveLayoutSchema.parse({...saved, scenes: {finished: {grid: {cols: 12, rows: 8}, widgets: []}}});
        expect(own.scenes?.finished?.widgets).toEqual([]);
    });

    it("resets a scene to its template", () => {
        const cleared = withLiveScene(defaultLiveLayout, "before", {...liveSceneLayout(defaultLiveLayout, "before"), widgets: []});
        const reset = withLiveSceneReset(cleared, "before");
        expect(liveSceneLayout(reset, "before").widgets).toEqual(liveSceneLayout(defaultLiveLayout, "before").widgets);
        const board = withLiveSceneReset({...defaultLiveLayout, widgets: []}, "running");
        expect(board.widgets.map(widget => widget.type)).toEqual(defaultLiveLayout.widgets.map(widget => widget.type));
    });

    it("keeps the screen settings shared while each scene keeps its canvas", () => {
        const before = liveSceneLayout(defaultLiveLayout, "before");
        const next = withLiveScene(defaultLiveLayout, "before", {...before, theme: "light", grid: {cols: 16, rows: 9}});
        expect(next.theme).toBe("light");
        expect(next.grid).toEqual(defaultLiveLayout.grid);
        expect(next.scenes?.before?.grid).toEqual({cols: 16, rows: 9});
        expect(liveSceneLayout(next, "finished").theme).toBe("light");
    });

    it("lists and maps every scene in the order of the event", () => {
        expect(liveSceneViews(defaultLiveLayout).map(item => item.key)).toEqual(["before", "running", "frozen", "finished"]);
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
        const empty = {grid: {cols: 12, rows: 8}, widgets: []};
        const layout: LiveLayout = {...defaultLiveLayout, widgets: qr(47), scenes: {before: {grid: {cols: 12, rows: 8}, widgets: qr(48)}, frozen: empty, finished: empty}};
        expect(liveWidgetsTotal(layout)).toBe(95);
        expect(liveWidgetLimit(layout, "running")).toBeNull();
        expect(liveWidgetLimit(layout, "before")).toBe("scene");
        expect(liveWidgetLimit({...layout, widgets: qr(48), scenes: {...layout.scenes, finished: {grid: {cols: 12, rows: 8}, widgets: []}}}, "finished")).toBe("total");
    });
});

