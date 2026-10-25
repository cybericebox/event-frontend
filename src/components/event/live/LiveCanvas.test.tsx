// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render} from "@testing-library/react";
import {defaultLiveLayout, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas, liveChartLegend} from "./LiveCanvas";
import {liveSampleResults} from "./liveSample";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {LiveStage} from "./liveStages";

vi.mock("./LiveQR", () => ({LiveQR: () => null}));
afterEach(() => {cleanup(); vi.useRealTimers(); vi.unstubAllGlobals();});

// jsdom has no layout: every observed box reports this size, so the fit-based blocks render.
function stubBoxes(width = 1200, height = 400) {
    vi.stubGlobal("ResizeObserver", class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element) {this.callback([{target, contentRect: {width, height}} as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);}
        unobserve() {}
        disconnect() {}
    });
}

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
        Revision: 1, TotalTeams: count,
        Freeze: {BannerText: "", BannerLevel: "warning" as const, Enabled: !!freeze, FrozenAt: freeze ?? null, FinishAt: null, OpenedAt: null, Active: !!freeze, Applied: !!freeze},
        Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
        Scoreboard: Array.from({length: count}, (_, index) => ({Rank: index + 1, TeamID: teamID(index + 1), TeamName: `Команда ${index + 1}`, Points: (count - index) * 100, Solved: 1})),
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
        const {container} = await mount(only({type: "table", w: 4, h: 4}), false, {results: board(0)});
        expect(container.querySelector(".live-list .ib-empty")).not.toBeNull();
    });

    it("shows the event logo in data blocks until the first results arrive", async () => {
        const {container} = await mount(only({type: "table", w: 4, h: 4}));
        expect(container.querySelector(".live-widget > .event-block-state .event-loading-logo")).not.toBeNull();
        expect(container.querySelector(".ib-empty")).toBeNull();
    });

    it("names the current stage and counts to its end", async () => {
        const stages = [{Name: "Етап 1", OpensAt: new Date(now - 600_000).toISOString(), ClosesAt: new Date(now + 1800_000).toISOString()}];
        const {container} = await mount(only({type: "timer"}), false, {stages});
        expect(container.querySelector(".live-timer small")?.textContent).toBe("До кінця: Етап 1");
        expect(container.querySelector(".live-timer strong")?.textContent).toMatch(/^29:5\d$/);
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

    it("never puts the event logo into an organizers block without logos", async () => {
        const withLogo = {...event, LogoURL: "/api/events/e/logo/l"} as PublicEventInfo;
        const {container} = await mount(only({type: "logos", props: {mode: "fixed", title: "Організатори"}}), false, {on: withLogo});
        expect(container.querySelector(".live-logos")).toBeNull();
    });

    it("drops a logo that does not load, and the block when none is left", async () => {
        const items = [{src: "/api/events/e/content-images/a"}, {src: "/api/events/e/content-images/b"}];
        const {container} = await mount(only({type: "logos", props: {mode: "fixed", title: "Партнери", items}}));
        expect(container.querySelectorAll(".live-logo")).toHaveLength(2);
        await act(async () => {fireEvent.error(container.querySelectorAll(".live-logo img")[0]);});
        expect(container.querySelectorAll(".live-logo")).toHaveLength(1);
        await act(async () => {fireEvent.error(container.querySelector(".live-logo img")!);});
        expect(container.querySelector(".live-logos")).toBeNull();
    });

    it("recolours monochrome logos by a filter, not a cross-origin mask", async () => {
        const {container} = await mount(only({type: "logos", props: {mode: "fixed", items: [{src: "/api/events/e/content-images/a"}]}}));
        const logo = container.querySelector(".live-logo") as HTMLElement;
        expect(logo.closest(".live-logos--mono")).not.toBeNull();
        expect(logo.getAttribute("style") ?? "").not.toMatch(/mask/i);
    });

    it("hides the title logo tile when the logo does not load", async () => {
        const withLogo = {...event, LogoURL: "/api/events/e/logo/l"} as PublicEventInfo;
        const {container} = await mount(only({type: "title"}), false, {on: withLogo});
        expect(container.querySelector(".live-title__logo")).not.toBeNull();
        await act(async () => {fireEvent.error(container.querySelector(".live-title__logo img")!);});
        expect(container.querySelector(".live-title__logo")).toBeNull();
    });
});

describe("live canvas blocks of step 2", () => {
    it("puts places 2-1-3 on the podium, the winner in the middle and tallest", async () => {
        stubBoxes();
        const {container} = await mount(only({type: "podium", w: 12, h: 3}), false, {results: board(5)});
        const tiles = [...container.querySelectorAll(".live-podium__tile")];
        expect(tiles.map(tile => tile.querySelector(".live-podium__place")?.textContent)).toEqual(["2", "1", "3"]);
        expect(tiles[1].classList.contains("is-lead")).toBe(true);
        expect((tiles[1] as HTMLElement).style.height).toBe("100%");
        expect(container.querySelector(".live-podium h2")).toBeNull();
        expect(tiles[0].querySelector(".live-podium__points")?.textContent).toBe("400");
    });

    it("hides the podium points and shows the centered empty state without teams", async () => {
        stubBoxes();
        const hidden = await mount(only({type: "podium", w: 12, h: 3, props: {showPoints: false}}), false, {results: board(3)});
        expect(hidden.container.querySelector(".live-podium__points")).toBeNull();
        cleanup();
        const empty = await mount(only({type: "podium", w: 12, h: 3}), false, {results: board(0)});
        expect(empty.container.querySelector(".live-podium .ib-empty")).not.toBeNull();
    });

    it("shows the chosen facts as values over labels", async () => {
        stubBoxes();
        const {container} = await mount(only({type: "facts", w: 8, h: 2, props: {items: ["teams", "start"]}}), false, {results: {...board(12), Tasks: 30}});
        const values = [...container.querySelectorAll(".live-facts dd")].map(item => item.textContent);
        expect(values[0]).toBe("12");
        expect(values[1]).toMatch(/^\d\d:\d\d$/);
        expect([...container.querySelectorAll(".live-facts dt")].map(item => item.textContent)[0]).toBe("команд");
    });

    it("lists the stages with the running one marked, and can drop the done ones", async () => {
        const stages = [
            {Name: "Етап 1", OpensAt: new Date(now - 7200_000).toISOString(), ClosesAt: new Date(now - 3600_000).toISOString()},
            {Name: "Етап 2", OpensAt: new Date(now - 600_000).toISOString(), ClosesAt: new Date(now + 1800_000).toISOString()},
            {Name: "Етап 3", OpensAt: new Date(now + 3600_000).toISOString(), ClosesAt: new Date(now + 7200_000).toISOString()},
        ];
        const all = await mount(only({type: "stages", w: 4, h: 4}), false, {stages});
        expect([...all.container.querySelectorAll(".live-stages li")].map(item => item.className)).toEqual(["is-done", "is-now", "is-next"]);
        cleanup();
        const ahead = await mount(only({type: "stages", w: 4, h: 4, props: {showDone: false}}), false, {stages});
        expect(ahead.container.querySelectorAll(".live-stages li")).toHaveLength(2);
    });

    it("shows the clock of the screen", async () => {
        const {container} = await mount(only({type: "clock", w: 3, h: 1, props: {label: "Київ"}}));
        expect(container.querySelector(".live-clock small")?.textContent).toBe("Київ");
        expect(container.querySelector(".live-clock strong")?.textContent).toMatch(/^\d\d:\d\d$/);
    });

    it("hides a caption or replaces its text", async () => {
        const hidden = await mount(only({type: "table", w: 4, h: 4, props: {showCaption: false}}), false, {results: board(3)});
        expect(hidden.container.querySelector(".live-list h2")).toBeNull();
        cleanup();
        const own = await mount(only({type: "table", w: 4, h: 4, props: {caption: "Рейтинг"}}), false, {results: board(3)});
        expect(own.container.querySelector(".live-list h2")?.textContent).toBe("Рейтинг");
    });

    it("scales the text of one block by its own size", async () => {
        const {container} = await mount({...defaultLiveLayout, widgets: [
            {id: "big", type: "table", x: 1, y: 1, w: 4, h: 4, props: {textSize: "xl"}},
            {id: "plain", type: "table", x: 5, y: 1, w: 4, h: 4, props: {}},
        ]}, false, {results: board(3)});
        const [big, plain] = [...container.querySelectorAll(".live-widget")] as HTMLElement[];
        expect(big.style.getPropertyValue("--live-u")).toContain("* 1.45");
        expect(plain.style.getPropertyValue("--live-u")).toBe("");
    });

    it("splits a wide table into two columns and starts after the podium", async () => {
        const {container} = await mount(only({type: "table", w: 12, h: 4, props: {columns: 2, offset: 3, limit: 8, rowsPerPage: 4}}), false, {results: board(20)});
        const columns = [...container.querySelectorAll(".live-table-columns > .live-table")];
        expect(columns).toHaveLength(2);
        expect(columns.map(column => [...column.querySelectorAll("tbody tr")].map(row => row.querySelector("td")?.textContent))).toEqual([["4", "5", "6", "7"], ["8", "9", "10", "11"]]);
    });

    it("turns the timer into an accent tile in its last minutes, then drops the label", async () => {
        const target = (seconds: number) => ({type: "timer" as const, props: {source: "custom", target: new Date(now + 1000 + seconds * 1000).toISOString(), lastMinutes: 5}});
        const urgent = await mount(only(target(240)));
        expect(urgent.container.querySelector(".live-timer--urgent small")).not.toBeNull();
        cleanup();
        const final = await mount(only(target(30)));
        expect(final.container.querySelector(".live-timer--final")).not.toBeNull();
        expect(final.container.querySelector(".live-timer small")).toBeNull();
    });

    it("shows an own text at zero, or nothing", async () => {
        const passed = {source: "custom", target: new Date(now - 60_000).toISOString()};
        const text = await mount(only({type: "timer", props: {...passed, atZero: "text", zeroText: "Здаємо роботи"}}));
        expect(text.container.querySelector(".live-timer strong")?.textContent).toBe("Здаємо роботи");
        cleanup();
        const hidden = await mount(only({type: "timer", props: {...passed, atZero: "hide"}}));
        expect(hidden.container.querySelector(".live-timer strong")).toBeNull();
    });

    it("paints the initials circles in the team colours of the chart; teams below the top 15 are «others»", async () => {
        stubBoxes(1200, 2400);
        const layout: LiveLayout = {...defaultLiveLayout, widgets: [
            {id: "c", x: 1, y: 1, w: 4, h: 2, type: "chart", props: {lines: 15}},
            {id: "t", x: 5, y: 1, w: 4, h: 6, type: "table", props: {showInitials: true, rowsPerPage: 20}},
        ]};
        const {container} = await mount(layout, false, {results: board(17)});
        const lines = [...container.querySelectorAll(".live-chart__plot svg g")].map(group => group.querySelectorAll("path")[1].getAttribute("stroke"));
        const circles = [...container.querySelectorAll<HTMLElement>(".live-table__avatar")].map(item => item.style.getPropertyValue("--live-avatar"));
        expect(circles.length).toBe(17);
        expect(new Set(circles.slice(0, 15))).toEqual(new Set(lines));
        expect(circles.slice(15)).toEqual(["var(--ib-live-other)", "var(--ib-live-other)"]);
    });

    it("draws up to 15 chart lines, each in its team colour over a halo", async () => {
        const legend = liveChartLegend(liveSampleResults(now), 25, "#211A52");
        expect(legend.size).toBe(15);
        expect(new Set(legend.values()).size).toBe(15);
        stubBoxes(1200, 800);
        const {container} = await mount(only({type: "chart", w: 8, h: 6, props: {lines: 20}}), true);
        const groups = [...container.querySelectorAll(".live-chart__plot svg g")];
        expect(groups.length).toBe(15);
        const lines = groups.map(group => group.querySelectorAll("path")[1].getAttribute("stroke"));
        expect(new Set(lines).size).toBe(15);
        expect(new Set(groups.map(group => group.querySelector("path")!.getAttribute("stroke"))).size).toBe(1);
    });

    it("shows the whole screen in capitals when the screen asks for it", async () => {
        const plain = await mount(only({type: "timer"}));
        expect(plain.container.querySelector(".live-canvas--upper")).toBeNull();
        cleanup();
        const layout = only({type: "timer"});
        const upper = await mount({...layout, screen: {...layout.screen, uppercase: true}});
        expect(upper.container.querySelector(".live-canvas")?.classList.contains("live-canvas--upper")).toBe(true);
    });

    it("previews a scene at a moment of its state", async () => {
        vi.useFakeTimers({now});
        const view = render(<LiveCanvas layout={only({type: "timer"})} event={event} nowOffset={-2 * 3600_000} />);
        await act(async () => {vi.advanceTimersByTime(1000);});
        // Two hours back is before the start: the timer counts to it.
        expect(view.container.querySelector(".live-timer small")?.textContent).toBe("До початку");
    });

    it("keeps the stage time line at the caption floor with many stages", async () => {
        stubBoxes(400, 400);
        const stages = Array.from({length: 8}, (_, index) => ({Name: `Етап ${index + 1}`, OpensAt: new Date(now + index * 3600_000).toISOString(), ClosesAt: new Date(now + (index + 0.9) * 3600_000).toISOString()}));
        const {container} = await mount(only({type: "stages", w: 4, h: 6}), false, {stages});
        const lines = [...container.querySelectorAll(".live-stages small")] as HTMLElement[];
        expect(lines).toHaveLength(8);
        lines.forEach(line => expect(parseFloat(line.style.fontSize)).toBeGreaterThanOrEqual(18));
        expect(parseFloat((container.querySelector(".live-stages") as HTMLElement).style.fontSize)).toBeGreaterThanOrEqual(20);
    });

    it("leaves the points out of the first solves", async () => {
        const results = {...board(2), Timeline: [{EventTeamID: teamID(1), EventChallengeID: teamID(90), ChallengeName: "Web: Login", Points: 100, SolvedAt: new Date(now - 60_000).toISOString()}]};
        const first = await mount(only({type: "solves", w: 4, h: 3, props: {mode: "first"}}), false, {results});
        expect(first.container.querySelector(".live-solves li b")).toBeNull();
        expect(first.container.querySelector(".live-solves li strong")?.textContent).toBe("Команда 1");
        expect(first.container.querySelector(".live-solves li em")?.textContent).toBe("Web: Login");
        cleanup();
        const recent = await mount(only({type: "solves", w: 4, h: 3}), false, {results});
        expect(recent.container.querySelector(".live-solves li b")?.textContent).toBe("+100");
    });

    it("counts only the places a limited table shows in its page range", async () => {
        const {container} = await mount(only({type: "table", w: 4, h: 6, props: {limit: 20, rowsPerPage: 10, pinTop: 0}}), false, {results: board(47)});
        expect(container.querySelector(".live-list__range")?.textContent).toMatch(/ з 20$/);
    });
});
