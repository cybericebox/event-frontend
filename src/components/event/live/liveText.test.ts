import {describe, expect, it} from "vitest";
import {defaultLiveLayout, type LiveLayout} from "@/api/manageLive";
import {liveTextSize, liveTextVars, liveTextWarnings} from "./liveText";

const led: LiveLayout = {...defaultLiveLayout, aspect: "custom", screen: {width: 1040, height: 624, anchor: "top-left", textScale: 1}};

describe("liveTextSize", () => {
    it("scales with the screen height and keeps the floors", () => {
        expect(liveTextSize("body", 1080, 1)).toEqual({natural: 26.1, effective: 26.1});
        expect(liveTextSize("body", 624, 1)).toEqual({natural: 15.1, effective: 19});
        expect(liveTextSize("caption", 624, 1.5).effective).toBe(15.6);
        expect(liveTextSize("timer", 624, 1).effective).toBe(34);
    });

    it("exposes the same formula to CSS", () => {
        expect(liveTextVars(1.2)).toMatchObject({"--live-u": "calc(100cqh / 36 * 1.2)", "--live-fs-body": "max(19px, calc(var(--live-u) * 0.87))"});
    });
});

describe("liveTextWarnings", () => {
    it("is quiet for the classic layout on Full HD", () => {
        expect(liveTextWarnings(defaultLiveLayout)).toEqual([]);
    });

    it("warns about small body text and captions on the 1040×624 LED wall", () => {
        const warnings = liveTextWarnings(led);
        const table = warnings.filter(item => item.id === "table").map(item => item.text).join("\n");
        expect(table).toMatch(/основний текст 15 px, підписи 10 px/);
        expect(table).toMatch(/19 px \/ 14 px/);
    });

    it("names rows that no longer fit", () => {
        const crowded: LiveLayout = {...led, widgets: led.widgets.map(item => item.id === "table" ? {...item, props: {rowsPerPage: 20}} : item)};
        expect(liveTextWarnings(crowded).some(item => item.id === "table" && /вміщується \d+ з 20 рядків/.test(item.text))).toBe(true);
    });

    it("ignores legacy A/D tables", () => {
        const legacy: LiveLayout = {...defaultLiveLayout, widgets: [{id: "ad", type: "ad_table", x: 1, y: 1, w: 6, h: 4, props: {}}]};
        expect(liveTextWarnings({...legacy, screen: led.screen})).toEqual([]);
    });
});
