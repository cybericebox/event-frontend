import {describe, expect, it} from "vitest";
import {defaultLiveLayout} from "@/api/manageLive";
import {livePreviewLayout, livePreviewScale} from "./livePreview";
import {liveFormatLayout} from "./liveFormats";
import {liveTextProfile, liveTextSize} from "./liveText";

describe("livePreviewLayout: the editor preview at a target resolution", () => {
    it("keeps the layout as it is", () => {
        expect(livePreviewLayout(defaultLiveLayout, "layout")).toBe(defaultLiveLayout);
    });

    it("renders 16:9 at the projector sizes", () => {
        expect(livePreviewLayout(defaultLiveLayout, "720").screen).toMatchObject({width: 1280, height: 720, anchor: "full"});
        expect(livePreviewLayout(defaultLiveLayout, "768").screen).toMatchObject({width: 1366, height: 768});
        expect(livePreviewLayout(defaultLiveLayout, "1080").screen).toMatchObject({width: 1920, height: 1080});
    });

    it("keeps the shape being edited: 4:3 at 720p is 960×720", () => {
        expect(livePreviewLayout(liveFormatLayout(defaultLiveLayout, "4:3"), "720").screen).toMatchObject({width: 960, height: 720});
    });

    it("uses the LED area and its floors for «LED»", () => {
        const led = livePreviewLayout(defaultLiveLayout, "led");
        expect(led.screen).toMatchObject({width: 1040, height: 624, anchor: "top-left"});
        expect(liveTextProfile(led.screen)).toBe("led");
    });

    it("changes the screen only, never the canvas", () => {
        const preview = livePreviewLayout(defaultLiveLayout, "720");
        expect(preview.widgets).toBe(defaultLiveLayout.widgets);
        expect(preview.grid).toBe(defaultLiveLayout.grid);
        expect(preview.scenes).toBe(defaultLiveLayout.scenes);
    });
});

describe("livePreviewScale", () => {
    it("scales the native render into the stage, so text keeps its real size inside", () => {
        const screen = livePreviewLayout(defaultLiveLayout, "720").screen;
        const scale = livePreviewScale(640, screen);
        expect(scale).toBe(0.5);
        // The text is computed for 720p (the projector floors), then scaled with the canvas.
        expect(liveTextSize("body", screen.height, 1, screen.width).effective).toBe(20);
        expect(liveTextSize("body", screen.height, 1, screen.width).effective * scale).toBe(10);
    });

    it("waits for the stage size", () => {
        expect(livePreviewScale(0, {width: 1920})).toBe(0);
    });
});
