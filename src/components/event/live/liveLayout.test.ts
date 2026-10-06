import {describe, expect, it} from "vitest";
import {defaultLiveLayout, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import {distributeWidgets, layoutConflicts, livePaletteItems, liveWidgetName, presetLayout, recomputeGrid, widgetAt} from "./liveLayout";

const item = (id: string, type: LiveWidget["type"], x: number, y: number, w: number, h: number, props: LiveWidget["props"] = {}): LiveWidget => ({id, type, x, y, w, h, props});
const layoutOf = (widgets: LiveWidget[], cols = 12, rows = 8): LiveLayout => ({...defaultLiveLayout, grid: {cols, rows}, widgets});

describe("recomputeGrid", () => {
    it("doubles the classic preset exactly on 0-based cells", () => {
        const next = recomputeGrid(defaultLiveLayout, 24, 16);
        expect(next.grid).toEqual({cols: 24, rows: 16});
        expect(next.widgets.map(({x, y, w, h}) => [x, y, w, h])).toEqual([[1, 1, 20, 2], [1, 3, 16, 12], [17, 3, 8, 12], [1, 15, 6, 2], [7, 15, 18, 2], [21, 1, 4, 2]]);
        expect(layoutConflicts(next).size).toBe(0);
    });

    it("scales back down and keeps the order of widgets", () => {
        const next = recomputeGrid(recomputeGrid(defaultLiveLayout, 24, 16), 12, 8);
        expect(next.widgets).toEqual(defaultLiveLayout.widgets);
    });

    it("moves a widget that lands on another down to free rows", () => {
        // At half width the 2nd and 3rd 1-column widgets round onto the same cell.
        const next = recomputeGrid(layoutOf([item("a", "qr", 1, 1, 1, 1), item("b", "qr", 2, 1, 1, 1), item("c", "qr", 3, 1, 1, 1)], 6, 6), 3, 6);
        expect(next.widgets.map(({x, y}) => [x, y])).toEqual([[1, 1], [2, 1], [2, 2]]);
        expect(layoutConflicts(next).size).toBe(0);
    });

    it("keeps an unplaceable widget and reports the conflict instead of refusing", () => {
        const next = recomputeGrid(layoutOf([item("a", "chart", 1, 1, 4, 3), item("b", "chart", 5, 1, 4, 3)], 8, 3), 4, 3);
        expect(next.widgets).toHaveLength(2);
        expect([...layoutConflicts(next)].sort()).toEqual(["a", "b"]);
    });
});

describe("layoutConflicts", () => {
    it("flags overlaps, cells outside the grid and sizes below the minimum", () => {
        const conflicts = layoutConflicts(layoutOf([item("a", "title", 1, 1, 3, 1), item("b", "qr", 2, 1, 1, 1), item("c", "qr", 12, 9, 1, 1), item("d", "chart", 1, 3, 2, 3), item("e", "qr", 12, 1, 1, 1)]));
        expect([...conflicts].sort()).toEqual(["a", "b", "c", "d"]);
    });
});

describe("distributeWidgets", () => {
    it("splits a row into equal widths", () => {
        const next = distributeWidgets(defaultLiveLayout, "organizers", "row");
        if (typeof next === "string") throw new Error(next);
        expect(next.widgets.filter(widget => widget.y === 8).map(({x, w}) => [x, w])).toEqual([[1, 6], [7, 6]]);
    });

    it("gives the remainder to the first widgets", () => {
        const next = distributeWidgets(layoutOf([item("a", "qr", 1, 1, 1, 1), item("b", "qr", 2, 1, 5, 1), item("c", "qr", 7, 1, 1, 1)]), "b", "row");
        if (typeof next === "string") throw new Error(next);
        expect(next.widgets.map(({x, w}) => [x, w])).toEqual([[1, 3], [4, 2], [6, 2]]);
    });

    it("splits a column into equal heights", () => {
        const next = distributeWidgets(layoutOf([item("a", "qr", 1, 1, 2, 1), item("b", "qr", 1, 2, 2, 5)]), "a", "column");
        if (typeof next === "string") throw new Error(next);
        expect(next.widgets.map(({y, h}) => [y, h])).toEqual([[1, 3], [4, 3]]);
    });

    it("refuses a split below a widget minimum", () => {
        expect(distributeWidgets(layoutOf([item("a", "qr", 1, 1, 1, 3), item("b", "chart", 2, 1, 4, 3)]), "a", "row")).toMatch(/Динаміка результатів/);
    });

    it("needs a neighbour of the same height", () => {
        expect(distributeWidgets(layoutOf([item("title", "title", 1, 1, 12, 1)]), "title", "row")).toMatch(/немає інших/);
    });
});

describe("palette and drop", () => {
    it("does not offer the A/D table", () => {
        const types = livePaletteItems.map(entry => entry.type);
        expect(types).not.toContain("ad_table");
        expect(types).toContain("timer");
    });

    it("offers organizers and partners as two logo blocks", () => {
        expect(livePaletteItems.filter(entry => entry.type === "logos").map(entry => entry.props.mode)).toEqual(["fixed", "carousel"]);
    });

    it("names a logos widget by its title", () => {
        expect(liveWidgetName(item("p", "logos", 1, 1, 2, 1, {title: "Партнери"}))).toBe("Партнери");
        expect(liveWidgetName(item("c", "chart", 1, 1, 4, 3))).toBe("Динаміка результатів");
    });

    it("shows the timer in the default layout and the classic preset", () => {
        expect(defaultLiveLayout.widgets.some(widget => widget.type === "timer")).toBe(true);
        expect(presetLayout("classic").widgets.some(widget => widget.type === "timer")).toBe(true);
        expect(layoutConflicts(presetLayout("classic")).size).toBe(0);
    });

    it("places a dropped widget at the cell, clamped inside the grid", () => {
        const empty = layoutOf([]);
        expect(widgetAt(empty, "chart", 11, 7)).toMatchObject({x: 9, y: 6, w: 4, h: 3});
        expect(widgetAt(defaultLiveLayout, "qr", 2, 2)).toBeNull();
    });
});
