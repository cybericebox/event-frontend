import {describe, expect, it} from "vitest";
import {defaultLiveLayout} from "@/api/manageLive";
import {layoutConflicts} from "./liveLayout";
import {liveFormatLayout, liveFormatMode, liveFormatTabs, pickLiveFormat, pruneLiveFormats, withLiveFormatMode, withLiveFormatView} from "./liveFormats";

describe("live screen formats", () => {
    it("picks the nearest shape for the window, 21:9 and 5:4 included", () => {
        expect(pickLiveFormat(defaultLiveLayout, 16 / 9)).toBe("16:9");
        expect(pickLiveFormat(defaultLiveLayout, 21 / 9)).toBe("16:9");
        expect(pickLiveFormat(defaultLiveLayout, 1.6)).toBe("16:10");
        expect(pickLiveFormat(defaultLiveLayout, 4 / 3)).toBe("4:3");
        expect(pickLiveFormat(defaultLiveLayout, 5 / 4)).toBe("4:3");
    });

    it("offers the base first, then the other shapes", () => {
        expect(liveFormatTabs(defaultLiveLayout)).toEqual(["16:9", "16:10", "4:3"]);
        expect(liveFormatTabs({...defaultLiveLayout, aspect: "4:3"})).toEqual(["4:3", "16:9", "16:10"]);
    });

    it("stretches the base on an automatic shape", () => {
        const view = liveFormatLayout(defaultLiveLayout, "4:3");
        expect(liveFormatMode(defaultLiveLayout, "4:3")).toBe("auto");
        expect(view.screen).toMatchObject({width: 1440, height: 1080});
        expect(view.widgets).toEqual(defaultLiveLayout.widgets);
        expect(layoutConflicts(view).size).toBe(0);
    });

    it("edits a custom shape without touching the base", () => {
        const custom = withLiveFormatMode(defaultLiveLayout, "4:3", "custom");
        expect(liveFormatMode(custom, "4:3")).toBe("custom");
        const view = liveFormatLayout(custom, "4:3");
        const moved = {...view, widgets: view.widgets.map(widget => widget.id === "table" ? {...widget, x: 1, y: 2, w: 12, h: 3} : widget.id === "chart" ? {...widget, x: 1, y: 5, w: 12, h: 3} : widget)};
        const next = withLiveFormatView(custom, "4:3", moved);
        expect(next.widgets).toEqual(defaultLiveLayout.widgets);
        expect(liveFormatLayout(next, "4:3").widgets.find(widget => widget.id === "table")).toMatchObject({x: 1, y: 2, w: 12, h: 3});
        expect(layoutConflicts(liveFormatLayout(next, "4:3")).size).toBe(0);
    });

    it("places widgets added later and forgets removed ones", () => {
        const custom = withLiveFormatMode({...defaultLiveLayout, widgets: defaultLiveLayout.widgets.filter(widget => widget.id !== "timer")}, "4:3", "custom");
        const withTimer = {...custom, widgets: [...custom.widgets, defaultLiveLayout.widgets.find(widget => widget.id === "timer")!]};
        expect(liveFormatLayout(withTimer, "4:3").widgets.some(widget => widget.id === "timer")).toBe(true);
        const pruned = pruneLiveFormats({...withTimer, widgets: withTimer.widgets.filter(widget => widget.id !== "chart")});
        expect(pruned.formats?.["4:3"].placements?.some(place => place.id === "chart")).toBe(false);
        expect(pruneLiveFormats({...custom, aspect: "4:3"}).formats).toBeUndefined();
    });
});
