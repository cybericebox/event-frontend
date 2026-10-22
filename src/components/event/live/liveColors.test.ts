import {describe, expect, it} from "vitest";
import type {LiveWidget} from "@/api/manageLive";
import {liveBlockColors, liveFillOf, liveHighlightOf, liveMedalColors, livePlaceColors, liveReadableInk} from "./liveColors";

const theme = {Brand: "#211A52", Accent: "#FFD166", AccentLight: "#7A5A00", AccentDark: "#FFD166", AccentLive: "#FFD166", Version: 1};
const block = (props: LiveWidget["props"], type: LiveWidget["type"] = "table"): LiveWidget => ({id: "a", type, x: 1, y: 1, w: 4, h: 4, props});

describe("live block colours", () => {
    it("keeps the screen theme until a block has colours of its own", () => {
        const colors = liveBlockColors(block({}), theme, "dark");
        expect(colors.className).toBe("");
        expect(colors.style).toEqual({});
    });

    it("picks readable text on a fill", () => {
        expect(liveReadableInk("#FFFFFF")).toBe("#16152B");
        expect(liveReadableInk("#101020")).toBe("#FFFFFF");
        const colors = liveBlockColors(block({background: "#F4F4F4"}), theme, "dark");
        expect(colors.className).toContain("live-widget--fill");
        expect(colors.style).toMatchObject({"--live-widget-bg": "#F4F4F4", "--live-ink": "#16152B"});
        expect(colors.textContrast).toBeGreaterThan(4.5);
    });

    it("turns the accent into the text colour on an accent fill", () => {
        const colors = liveBlockColors(block({background: "accent"}), theme, "dark");
        expect(colors.style).toMatchObject({"--live-widget-bg": "#FFD166", "--live-ink": "#16152B", "--live-accent": "#16152B"});
    });

    it("keeps an own text and accent colour and reports a low contrast", () => {
        const colors = liveBlockColors(block({background: "#FFFFFF", textColor: "#EEEEEE", accentColor: "#00AA55"}), theme, "dark");
        expect(colors.style).toMatchObject({"--live-ink": "#EEEEEE", "--live-accent": "#00AA55"});
        expect(colors.textContrast).toBeLessThan(4.5);
    });

    it("ignores values that are not colours", () => {
        expect(liveFillOf(block({background: "red"}))).toBe("none");
        expect(liveFillOf(block({background: "brand"}))).toBe("brand");
    });

    it("sets medal colours for the top three of a table or podium only", () => {
        expect(liveHighlightOf(block({}))).toBe("accent");
        expect(livePlaceColors(block({placeColors: ["#111111", "#222222"]}))).toEqual([...liveMedalColors]);
        const medals = liveBlockColors(block({highlightTop: "medals", placeColors: ["#FF0000", "#00FF00", "#0000FF"]}), theme, "dark");
        expect(medals.style).toMatchObject({"--live-place-1": "#FF0000", "--live-place-3": "#0000FF", "--live-place-ink-1": expect.any(String)});
        expect(liveBlockColors(block({highlightTop: "medals"}, "chart"), theme, "dark").style).toEqual({});
    });
});
