import {describe, expect, it} from "vitest";
import {defaultLiveLayout, type LiveLayout} from "@/api/manageLive";
import {layoutConflicts, liveGridValid} from "./liveLayout";
import {applyLiveTemplate, liveTemplatePreview, liveTemplates, type LiveTemplateKey} from "./liveTemplates";
import {liveSceneLayout, liveSceneViews} from "./liveScenes";
import {liveTextWarnings} from "./liveText";
import {livePreviewLayout} from "./livePreview";

const keys = Object.keys(liveTemplates) as LiveTemplateKey[];
const withFormat: LiveLayout = {...defaultLiveLayout, formats: {"4:3": {mode: "custom", grid: {cols: 8, rows: 10}, placements: [{id: "chart", x: 1, y: 2, w: 8, h: 4}]}}};

describe("live templates", () => {
    it("offers 4–8 ready screens besides the full show, the classic board and the empty grid", () => {
        const screens = keys.filter(key => !["show", "classic", "empty"].includes(key));
        expect(screens.length).toBeGreaterThanOrEqual(4);
        expect(screens.length).toBeLessThanOrEqual(8);
    });

    it("builds every scene on a valid 12×8 grid without overlaps", () => {
        for (const key of keys) {
            for (const {view} of liveSceneViews(applyLiveTemplate(defaultLiveLayout, key, "running"))) {
                expect(liveGridValid(view.grid.cols, view.grid.rows)).toBe(true);
                expect(layoutConflicts(view).size, key).toBe(0);
            }
        }
    });

    it("fits every block at 1280×720, 1920×1080 and on the LED wall", () => {
        for (const key of keys) {
            for (const {key: scene, view} of liveSceneViews(applyLiveTemplate(defaultLiveLayout, key, "running"))) {
                for (const preview of ["720", "1080", "led"] as const) {
                    const fits = liveTextWarnings(livePreviewLayout(view, preview), "Kharkiv Regional CTF 2026").filter(item => item.kind === "fit");
                    expect(fits.map(item => item.text), `${key} ${scene} ${preview}`).toEqual([]);
                }
            }
        }
    });

    it("fills only the scene being edited and drops that scene's custom shapes", () => {
        const next = applyLiveTemplate(withFormat, "bigboard", "running");
        expect(next.widgets.some(widget => widget.type === "chart")).toBe(false);
        expect(next.formats).toBeUndefined();
        expect(next.scenes).toEqual(defaultLiveLayout.scenes);
        const frozen = applyLiveTemplate(defaultLiveLayout, "finale", "frozen");
        expect(liveSceneLayout(frozen, "frozen").widgets.some(widget => widget.type === "podium")).toBe(true);
        expect(frozen.widgets).toEqual(defaultLiveLayout.widgets);
    });

    it("sets the whole chain with «Повний показ»: before, the board, its copy for the freeze, the finale", () => {
        const show = applyLiveTemplate({...withFormat, scenes: {...defaultLiveLayout.scenes, frozen: {grid: {cols: 12, rows: 8}, widgets: []}}}, "show", "finished");
        expect(liveSceneLayout(show, "frozen").widgets.map(widget => widget.type)).toEqual(show.widgets.map(widget => widget.type));
        expect(show.widgets.map(widget => widget.type)).toContain("solves");
        expect(liveSceneLayout(show, "before").widgets.map(widget => widget.type)).toEqual(expect.arrayContaining(["timer", "facts", "qr"]));
        expect(liveSceneLayout(show, "finished").widgets.map(widget => widget.type)).toEqual(expect.arrayContaining(["podium", "table"]));
        expect(show.formats).toBeUndefined();
        // Screen settings stay.
        expect(show.screen).toEqual(withFormat.screen);
    });

    it("previews a template by its own scene", () => {
        expect(liveTemplatePreview(defaultLiveLayout, "finale").widgets.some(widget => widget.type === "podium")).toBe(true);
        expect(liveTemplatePreview(defaultLiveLayout, "show").widgets.some(widget => widget.type === "solves")).toBe(true);
    });
});
