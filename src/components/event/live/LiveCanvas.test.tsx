// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render} from "@testing-library/react";
import {defaultLiveLayout, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "./LiveCanvas";
import {liveSampleResults} from "./liveSample";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {LiveStage} from "./liveStages";

vi.mock("./LiveQR", () => ({LiveQR: () => null}));
afterEach(() => {cleanup(); vi.useRealTimers();});

const now = Date.UTC(2026, 8, 29, 12);
const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Name: "Кібер-захід", StartTime: new Date(now - 3600_000).toISOString(), FinishTime: new Date(now + 5025_000).toISOString(),
    Participation: 1, LogoURL: "", Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} as unknown as PublicEventInfo;
const only = (widget: Partial<LiveWidget> & Pick<LiveWidget, "type">): LiveLayout => ({...defaultLiveLayout, widgets: [{id: "w", x: 1, y: 1, w: 4, h: 2, props: {}, ...widget}]});

async function mount(layout: LiveLayout, sample = false, {results, stages, on = event}: {results?: ManageResultsSnapshot; stages?: LiveStage[]; on?: PublicEventInfo} = {}) {
    vi.useFakeTimers({now});
    const view = render(<LiveCanvas layout={layout} event={on} stages={stages} results={results ?? (sample ? liveSampleResults(now) : undefined)} sample={sample} />);
    await act(async () => {vi.advanceTimersByTime(1000);});
    return view;
}

const teamID = (index: number) => `01900000-0000-7000-8000-${String(index).padStart(12, "0")}`;
function board(count: number, freeze?: string): ManageResultsSnapshot {
    return {
        Revision: 1, GeneratedAt: new Date(now).toISOString(), TotalTeams: count,
        Freeze: {Enabled: !!freeze, FrozenAt: freeze ?? null, FinishAt: null, OpenedAt: null, Active: !!freeze, Applied: !!freeze},
        Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
        Scoreboard: Array.from({length: count}, (_, index) => ({Rank: index + 1, TeamID: teamID(index + 1), TeamName: `Команда ${index + 1}`, Points: (count - index) * 100, Solved: 1, LastSolveAt: null})),
        Timeline: [],
    };
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

    it("names the current stage and counts to its end", async () => {
        const stages = [{Name: "Етап 1", OpensAt: new Date(now - 600_000).toISOString(), ClosesAt: new Date(now + 1800_000).toISOString()}];
        const {container} = await mount(only({type: "timer"}), false, {stages});
        expect(container.querySelector(".live-timer small")?.textContent).toBe("До кінця: Етап 1");
        expect(container.querySelector(".live-timer strong")?.textContent).toMatch(/^00:29:5\d$/);
    });

    it("shows «Завершено» instead of zeros after the finish", async () => {
        const finished = {...event, FinishTime: new Date(now - 60_000).toISOString()} as PublicEventInfo;
        const {container} = await mount(only({type: "timer"}), false, {on: finished});
        expect(container.querySelector(".live-timer strong")?.textContent).toBe("Завершено");
        expect(container.textContent).not.toContain("00:00:00");
    });

    it("shows the freeze badge at the timer, or in the title without a timer", async () => {
        const frozen = board(3, new Date(now - 600_000).toISOString());
        const withTimer = await mount({...defaultLiveLayout}, false, {results: frozen});
        expect(withTimer.container.querySelector(".live-timer .live-freeze")?.textContent).toMatch(/^Заморожено о \d\d:\d\d$/);
        expect(withTimer.container.querySelector(".live-title .live-freeze")).toBeNull();
        cleanup();
        const noTimer = await mount({...defaultLiveLayout, widgets: defaultLiveLayout.widgets.filter(item => item.type !== "timer")}, false, {results: frozen});
        expect(noTimer.container.querySelector(".live-title .live-freeze")).not.toBeNull();
    });

    it("pins the top 3, fills the last page and shows the page range", async () => {
        const layout = only({type: "table", w: 4, h: 6, props: {rowsPerPage: 10, pageSeconds: 10}});
        const {container} = await mount(layout, false, {results: board(15)});
        const rows = [...container.querySelectorAll(".live-table tbody tr")].map(row => row.querySelector("td")?.textContent);
        expect(rows).toHaveLength(10);
        expect(rows.slice(0, 3)).toEqual(["1", "2", "3"]);
        expect(container.querySelector(".live-list__range")?.textContent).toMatch(/^(1–10|9–15) з 15$/);
        expect(container.querySelector(".live-list__progress")).not.toBeNull();
    });

    it("hides a logos block that has no logo at all", async () => {
        const {container} = await mount(only({type: "logos", props: {mode: "fixed", title: "Партнери"}}));
        expect(container.querySelector(".live-logos")).toBeNull();
        expect(container.textContent).not.toContain("Партнери");
    });
});
