// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render} from "@testing-library/react";
import {defaultLiveLayout, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "./LiveCanvas";
import {liveSampleResults} from "./liveSample";

vi.mock("./LiveQR", () => ({LiveQR: () => null}));
afterEach(() => {cleanup(); vi.useRealTimers();});

const now = Date.UTC(2026, 8, 29, 12);
const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Name: "Кібер-захід", StartTime: new Date(now - 3600_000).toISOString(), FinishTime: new Date(now + 5025_000).toISOString(),
    Participation: 1, LogoURL: "", Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} as unknown as PublicEventInfo;
const only = (widget: Partial<LiveWidget> & Pick<LiveWidget, "type">): LiveLayout => ({...defaultLiveLayout, widgets: [{id: "w", x: 1, y: 1, w: 4, h: 2, props: {}, ...widget}]});

async function mount(layout: LiveLayout, sample = false) {
    vi.useFakeTimers({now});
    const view = render(<LiveCanvas layout={layout} event={event} results={sample ? liveSampleResults(now) : undefined} sample={sample} />);
    await act(async () => {vi.advanceTimersByTime(1000);});
    return view;
}

describe("live canvas widgets", () => {
    it("shows the timer with its caption and seconds by default", async () => {
        const {container} = await mount(only({type: "timer"}));
        expect(container.querySelector(".live-timer small")?.textContent).toBe("До завершення");
        expect(container.querySelector(".live-timer strong")?.textContent).toMatch(/^01:23:4\d$/);
    });

    it("hides the caption and the seconds when switched off", async () => {
        const {container} = await mount(only({type: "timer", props: {showLabel: false, showSeconds: false}}));
        expect(container.querySelector(".live-timer small")).toBeNull();
        expect(container.querySelector(".live-timer strong")?.textContent).toBe("01:23");
    });

    it("fills the table, recent solves and logos with sample data", async () => {
        const layout: LiveLayout = {...defaultLiveLayout, widgets: [
            {id: "t", type: "table", x: 1, y: 1, w: 4, h: 4, props: {rowsPerPage: 5}},
            {id: "s", type: "solves", x: 5, y: 1, w: 4, h: 4, props: {rows: 3}},
            {id: "l", type: "logos", x: 1, y: 5, w: 4, h: 1, props: {mode: "fixed"}},
        ]};
        const {container} = await mount(layout, true);
        expect(container.querySelectorAll(".live-table tbody tr")).toHaveLength(5);
        expect(container.querySelectorAll(".live-solves li")).toHaveLength(3);
        expect(container.querySelectorAll(".live-logos img").length).toBeGreaterThan(0);
    });

    it("shows the centered empty state without results", async () => {
        const {container} = await mount(only({type: "table", w: 4, h: 4}));
        expect(container.querySelector(".live-list .ib-empty")).not.toBeNull();
    });
});
