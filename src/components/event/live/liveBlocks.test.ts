import {describe, expect, it} from "vitest";
import type {LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {liveFactItems, liveFacts} from "./liveFacts";
import {liveFactsFit, livePodiumFit, liveTwoLineRow} from "./liveFit";
import {liveTimerDigits, liveTimerUrgency, liveTimerZero, type LiveTimerState} from "./liveStages";
import {liveSolveItems, liveTableSource} from "./LiveCanvas";
import {liveCaptionShown, liveCaptionText, liveTextFloors, liveTextSize, liveTextWarnings, liveWidgetTextScale} from "./liveText";
import {defaultLiveLayout} from "@/api/manageLive";
import {livePreviewLayout} from "./livePreview";

const widget = (type: LiveWidget["type"], props: LiveWidget["props"] = {}): LiveWidget => ({id: "w", type, x: 1, y: 1, w: 6, h: 3, props});
const id = (index: number) => `01900000-0000-7000-8000-${String(index).padStart(12, "0")}`;
const event = {Name: "Кібер-захід", StartTime: "2026-10-20T07:00:00Z", FinishTime: "2026-10-20T15:00:00Z", Participation: 1} as unknown as PublicEventInfo;
const results = {
    Revision: 1, TotalTeams: 47, Tasks: 32,
    Scoreboard: [{Rank: 1, TeamID: id(1), TeamName: "Frost", Points: 4000, Solved: 3}, {Rank: 2, TeamID: id(2), TeamName: "NURE Sec", Points: 3700, Solved: 2}],
    Timeline: [
        {EventTeamID: id(2), EventChallengeID: id(100), ChallengeName: "Web: Login Bypass", Points: 100, SolvedAt: "2026-10-20T07:31:00Z"},
        {EventTeamID: id(1), EventChallengeID: id(100), ChallengeName: "Web: Login Bypass", Points: 100, SolvedAt: "2026-10-20T07:40:00Z"},
        {EventTeamID: id(1), EventChallengeID: id(101), ChallengeName: "Crypto: RSA Oracle", Points: 300, SolvedAt: "2026-10-20T08:52:00Z"},
    ],
    Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
    Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
} as ManageResultsSnapshot;

describe("facts", () => {
    it("shows teams, tasks and the start by default", () => {
        expect(liveFactItems(widget("facts"))).toEqual(["teams", "tasks", "start"]);
        expect(liveFacts(["teams", "tasks"], event, results).map(fact => [fact.value, fact.label])).toEqual([["47", "команд"], ["32", "завдання"]]);
    });

    it("counts solves and solved tasks from the shown timeline, and names the first solve", () => {
        const facts = liveFacts(["solves", "solvedTasks", "firstBlood"], event, results);
        expect(facts[0]).toMatchObject({value: "3", label: "розвʼязання"});
        expect(facts[1]).toMatchObject({value: "2", label: "завдання розвʼязано"});
        expect(facts[2]).toMatchObject({value: "NURE Sec", text: true});
        expect(facts[2].label).toMatch(/^перше розвʼязання · Web: Login Bypass · \d\d:\d\d$/);
    });

    it("leaves out what the data has not: the task count outside the live view, the finish of an open event", () => {
        const page = {...results, Tasks: undefined};
        expect(liveFacts(["tasks", "teams"], {...event, FinishTime: null}, page).map(fact => fact.key)).toEqual(["teams"]);
        expect(liveFacts(["finish"], {...event, FinishTime: null}, results)).toEqual([]);
    });

    it("drops unknown and repeated keys, keeps at most six", () => {
        expect(liveFactItems(widget("facts", {items: ["teams", "salary", "teams", "start"]}))).toEqual(["teams", "start"]);
        expect(liveFactItems(widget("facts", {items: []}))).toEqual(["teams", "tasks", "start"]);
    });

    it("fits the values to the block and reports when they get too small", () => {
        const roomy = liveFactsFit({width: 800, height: 160, items: [{value: 2, label: 6}, {value: 2, label: 8}, {value: 5, label: 5}], display: 24, caption: 18});
        expect(roomy.readable).toBe(true);
        expect(roomy.value * 1.1 + roomy.label * 1.3).toBeLessThanOrEqual(160 + 0.01);
        expect(roomy.label).toBeGreaterThanOrEqual(18);
        expect(liveFactsFit({width: 200, height: 40, items: [{value: 5, label: 6}, {value: 5, label: 6}, {value: 5, label: 6}], display: 24, caption: 18}).readable).toBe(false);
    });
});

describe("podium", () => {
    it("sizes the names for the lowest tile and makes the winner larger", () => {
        const fit = livePodiumFit({width: 1200, height: 260, names: ["Frost", "NURE Sec", "IceBreakers"], body: 20, caption: 18});
        expect(fit.readable).toBe(true);
        expect(fit.lead).toBeGreaterThan(fit.name);
        expect(fit.meta).toBeGreaterThanOrEqual(18);
    });

    it("is not readable in a strip too low for three lines", () => {
        expect(livePodiumFit({width: 1200, height: 60, names: ["Frost"], body: 20, caption: 18}).readable).toBe(false);
    });
});

describe("timer format, zero and last minutes", () => {
    const at = Date.parse("2026-10-20T10:00:00Z");
    const countdown = (seconds: number): LiveTimerState => ({mode: "countdown", target: at + seconds * 1000, label: "До кінця"});

    it("prints HH:MM:SS, MM:SS under an hour (empty hours dropped), or words", () => {
        expect(liveTimerDigits(countdown(45 * 60 + 7), at, true, "full")).toBe("45:07");
        expect(liveTimerDigits(countdown(45 * 60 + 7), at, true, "compact")).toBe("45:07");
        expect(liveTimerDigits(countdown(2 * 3600 + 14 * 60), at, true, "compact")).toBe("02:14:00");
        expect(liveTimerDigits(countdown(2 * 3600 + 14 * 60 + 5), at, true, "words")).toBe("2 год 14 хв");
        expect(liveTimerDigits(countdown(14 * 60 + 5), at, false, "words")).toBe("14 хв");
        expect(liveTimerDigits(countdown(42), at, true, "words")).toBe("42 с");
    });

    it("shows the word, an own text or nothing once the target passed", () => {
        const passed: LiveTimerState = {mode: "word", word: "Завершено", label: "", reason: "passed"};
        expect(liveTimerZero(passed, undefined, undefined)).toBe("Завершено");
        expect(liveTimerZero(passed, "text", "Час вийшов")).toBe("Час вийшов");
        expect(liveTimerZero(passed, "text", "  ")).toBe("Завершено");
        expect(liveTimerZero(passed, "hide", undefined)).toBeNull();
        // A missing target is not a zero: it keeps its own word.
        expect(liveTimerZero({mode: "word", word: "Не задано", label: "", reason: "none"}, "hide", undefined)).toBe("Не задано");
    });

    it("stands out in the last minutes and drops the label in the last one", () => {
        expect(liveTimerUrgency(countdown(10 * 60), at, 5)).toBe("calm");
        expect(liveTimerUrgency(countdown(4 * 60), at, 5)).toBe("urgent");
        expect(liveTimerUrgency(countdown(30), at, 5)).toBe("final");
        expect(liveTimerUrgency(countdown(30), at, 0)).toBe("calm");
        expect(liveTimerUrgency({mode: "elapsed", since: at, label: ""}, at, 5)).toBe("calm");
    });
});

describe("table and solves options", () => {
    const teams = Array.from({length: 20}, (_, index) => index + 1);

    it("starts after the podium and stops after N places", () => {
        expect(liveTableSource(teams, {offset: 3, limit: 8})).toEqual({rows: [4, 5, 6, 7, 8, 9, 10, 11], offset: 3});
        expect(liveTableSource(teams, {}).rows).toHaveLength(20);
        expect(liveTableSource(teams, {limit: 5}).rows).toEqual([1, 2, 3, 4, 5]);
        expect(liveTableSource(teams, {offset: 2}).offset).toBe(0);
    });

    it("lists the first solve of each task, newest first", () => {
        expect(liveSolveItems(results.Timeline, "first", 5).map(item => [item.EventTeamID, item.ChallengeName])).toEqual([[id(1), "Crypto: RSA Oracle"], [id(2), "Web: Login Bypass"]]);
        expect(liveSolveItems(results.Timeline, "recent", 2).map(item => item.SolvedAt)).toEqual(["2026-10-20T08:52:00Z", "2026-10-20T07:40:00Z"]);
    });
});

describe("per-block text size and caption", () => {
    it("multiplies the screen scale by S / M / L / XL, never below the floors", () => {
        const at720 = (key: string) => liveTextSize("body", 720, liveWidgetTextScale(1, widget("table", {textSize: key})), 1280);
        expect(at720("s").effective).toBe(liveTextFloors.projector.body);
        expect(at720("m").effective).toBe(liveTextFloors.projector.body);
        expect(at720("xl").natural).toBeCloseTo(17.4 * 1.45, 0);
        expect(at720("xl").effective).toBeGreaterThan(liveTextFloors.projector.body);
        const at1080 = (key: string) => liveTextSize("body", 1080, liveWidgetTextScale(1, widget("table", {textSize: key})), 1920).effective;
        expect(at1080("s")).toBeLessThan(at1080("m"));
        expect(at1080("l")).toBeGreaterThan(at1080("m"));
        for (const key of ["s", "m", "l", "xl"]) {
            for (const role of ["body", "caption", "display"] as const) {
                expect(liveTextSize(role, 624, liveWidgetTextScale(1, widget("table", {textSize: key})), 1040, "led").effective).toBeGreaterThanOrEqual(liveTextFloors.led[role]);
            }
        }
    });

    it("leaves the blocks that fill their box (title, timer, clock) at their own size", () => {
        expect(liveWidgetTextScale(1.2, widget("timer", {textSize: "xl"}))).toBe(1.2);
        expect(liveWidgetTextScale(1, widget("chart", {textSize: "bogus"}))).toBe(1);
    });

    it("warns when a smaller size drops a block below the floors, and when a larger one does not fit", () => {
        // 1600×900: M reads above the projector floors, S falls under them.
        const table = {...defaultLiveLayout, screen: {...defaultLiveLayout.screen, width: 1600, height: 900}, widgets: [{id: "t", type: "table" as const, x: 1, y: 1, w: 4, h: 6, props: {textSize: "s"}}]};
        expect(liveTextWarnings(table).some(item => item.kind === "floor")).toBe(true);
        expect(liveTextWarnings({...table, widgets: [{...table.widgets[0], props: {textSize: "m"}}]})).toEqual([]);
        const crowded = livePreviewLayout({...table, widgets: [{...table.widgets[0], h: 3, props: {textSize: "xl", rowsPerPage: 8}}]}, "720");
        expect(liveTextWarnings(crowded).some(item => item.kind === "fit")).toBe(true);
    });

    it("shows the caption by default, an own text when set, and none when hidden", () => {
        expect(liveCaptionShown(widget("table"))).toBe(true);
        expect(liveCaptionShown(widget("podium"))).toBe(false);
        expect(liveCaptionShown(widget("table", {showCaption: false}))).toBe(false);
        expect(liveCaptionText(widget("table", {caption: " Рейтинг "}), "Таблиця результатів")).toBe("Рейтинг");
        expect(liveCaptionText(widget("logos", {title: "Партнери"}), "Логотипи")).toBe("Партнери");
        expect(liveCaptionShown(widget("timer"))).toBe(false);
    });
});

describe("stages block fit (I3)", () => {
    const hour = 3600_000, base = Date.parse("2026-10-20T07:00:00Z");
    const stagesOf = (count: number, name = (i: number) => `Етап ${i + 1}`) => Array.from({length: count}, (_, i) => ({
        Name: name(i), OpensAt: new Date(base + i * hour).toISOString(), ClosesAt: new Date(base + (i + 0.9) * hour).toISOString(),
    }));
    const stageLayout = (w: number, h: number) => livePreviewLayout({...defaultLiveLayout, widgets: [{id: "s", type: "stages", x: 1, y: 2, w, h, props: {}}]}, "720");
    const fits = (layout: ReturnType<typeof stageLayout>, stages: ReturnType<typeof stagesOf>) => liveTextWarnings(layout, "CTF", stages).filter(item => item.kind === "fit");

    it("is quiet for three stages in the template block", () => {
        expect(fits(stageLayout(4, 6), stagesOf(3))).toEqual([]);
    });

    it("counts the real stages: 8 keep the floors in a 4×6 block at 720p, 10 do not", () => {
        expect(fits(stageLayout(4, 6), stagesOf(8))).toEqual([]);
        expect(fits(stageLayout(4, 6), stagesOf(10)).map(item => item.text).join()).toMatch(/етапи \(10\)/);
    });

    it("warns at 720p when long names do not fit a narrow block", () => {
        expect(fits(stageLayout(3, 6), stagesOf(3, i => `Етап ${i + 1} · Реверс-інжиніринг і криптографія`))).toHaveLength(1);
    });

    it("never sizes the time line under the caption floor, nor the name under the body", () => {
        const fit = liveTwoLineRow({rowHeight: 50, width: 400, chars: 20, body: 20, caption: 18});
        expect(fit.name).toBeGreaterThanOrEqual(20);
        expect(fit.meta).toBeGreaterThanOrEqual(18);
        expect(fit.readable).toBe(false);
        expect(liveTwoLineRow({rowHeight: 120, width: 400, chars: 20, body: 20, caption: 18}).readable).toBe(true);
    });
});

describe("facts over more than one day (Q4)", () => {
    it("adds the date to the start and finish of a multi-day event only", () => {
        const twoDays = {...event, StartTime: "2026-10-20T07:00:00Z", FinishTime: "2026-10-21T15:00:00Z"} as PublicEventInfo;
        const [start, finish] = liveFacts(["start", "finish"], twoDays, results);
        expect(start.value).toMatch(/^\d\d\.\d\d \d\d:\d\d$/);
        expect(finish.value).toMatch(/^\d\d\.\d\d \d\d:\d\d$/);
        expect(liveFacts(["start"], event, results)[0].value).toMatch(/^\d\d:\d\d$/);
    });
});

describe("timer and table minors", () => {
    const at = Date.parse("2026-10-20T10:00:00Z");
    it("keeps HH:MM in «Коротко» when seconds are off", () => {
        const state: LiveTimerState = {mode: "countdown", target: at + 45 * 60_000, label: ""};
        expect(liveTimerDigits(state, at, false, "compact")).toBe("00:45");
        expect(liveTimerDigits(state, at, true, "compact")).toBe("45:00");
    });

    it("warns about a timer in words that cannot fit", () => {
        const layout = livePreviewLayout({...defaultLiveLayout, widgets: [{id: "t", type: "timer", x: 1, y: 1, w: 3, h: 1, props: {digits: "words"}}]}, "720");
        expect(liveTextWarnings(layout).some(item => item.kind === "fit")).toBe(true);
        expect(liveTextWarnings({...layout, widgets: [{...layout.widgets[0], props: {}}]}).some(item => item.kind === "fit")).toBe(false);
    });
});

describe("timer «Формат» choices", () => {
    it("maps each choice to the stored props and back", async () => {
        const {liveTimerFormat, liveTimerFormatProps} = await import("./liveStages");
        expect(liveTimerFormat({})).toBe("hms");
        expect(liveTimerFormat({showSeconds: false})).toBe("hm");
        expect(liveTimerFormat({digits: "compact", showSeconds: false})).toBe("hm");
        expect(liveTimerFormat({digits: "words", showSeconds: true})).toBe("words");
        for (const format of ["hms", "hm", "words"] as const) {
            const props = Object.fromEntries(Object.entries(liveTimerFormatProps(format)).filter(([, value]) => value !== null));
            expect(liveTimerFormat(props)).toBe(format);
        }
    });
});
