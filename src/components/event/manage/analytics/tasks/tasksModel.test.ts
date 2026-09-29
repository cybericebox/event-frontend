import {describe, expect, it} from "vitest";
import {noGroupID, TaskRowSchema, type AnalyticsTaskDetail, type AnalyticsTaskRow} from "@/api/manageAnalyticsTasks";
import {
    calibrationChartOption, calibrationHasData, detailHasActivity, difficultyLabel, emptyTaskFilters, filterTasks, formatDuration, formatPercent, groupName, groupOptions,
    isMismatch, solvesChartOption, taskFiltersActive, taskTotals, verdictTone,
} from "./tasksModel";

function row(extra: Partial<AnalyticsTaskRow> = {}): AnalyticsTaskRow {
    return TaskRowSchema.parse({
        ChallengeID: "c1", Name: "Web 1", Difficulty: "easy", Points: 100, GroupID: "g1", GroupName: "Web", Attempts: 10, Correct: 4, TeamsTried: 5, TeamsOpened: 6, Solves: 4,
        SolveRate: 0.8, MedianSinceStartSeconds: 600, MedianSinceOpenSeconds: null, FirstBloodTeam: "Blue", FirstBloodAt: null, HintsOpened: 2, HintPoints: 20,
        Calibration: {Verdict: "ok", ExpectedMin: 0.55, ExpectedMax: 0.9}, ...extra,
    });
}

describe("formatDuration", () => {
    it("writes the biggest two units and a dash for nothing", () => {
        expect(formatDuration(null)).toBe("—");
        expect(formatDuration(45)).toBe("45 с");
        expect(formatDuration(600)).toBe("10 хв");
        expect(formatDuration(3900)).toBe("1 год 05 хв");
        expect(formatDuration(90000)).toBe("1 д 1 год");
    });
    it("formats a rate", () => expect(formatPercent(0.256)).toBe("26%"));
});

describe("task filters", () => {
    const rows = [
        row(),
        row({ChallengeID: "c2", Name: "Pwn 1", GroupID: noGroupID, GroupName: "", Calibration: {Verdict: "too_hard", ExpectedMin: 0.55, ExpectedMax: 0.9}}),
        row({ChallengeID: "c3", Name: "Crypto", Calibration: {Verdict: "too_easy", ExpectedMin: 0.1, ExpectedMax: 0.45}}),
    ];
    it("matches the name ignoring case", () => expect(filterTasks(rows, {...emptyTaskFilters, search: "pwn"}).map(r => r.ChallengeID)).toEqual(["c2"]));
    it("filters by group, including the tasks with none", () => {
        expect(filterTasks(rows, {...emptyTaskFilters, group: "g1"}).map(r => r.ChallengeID)).toEqual(["c1", "c3"]);
        expect(filterTasks(rows, {...emptyTaskFilters, group: noGroupID}).map(r => r.ChallengeID)).toEqual(["c2"]);
    });
    it("filters the mismatches", () => {
        expect(filterTasks(rows, {...emptyTaskFilters, verdict: "mismatch"}).map(r => r.ChallengeID)).toEqual(["c2", "c3"]);
        expect(filterTasks(rows, {...emptyTaskFilters, verdict: "too_easy"}).map(r => r.ChallengeID)).toEqual(["c3"]);
    });
    it("knows when a filter is on", () => {
        expect(taskFiltersActive(emptyTaskFilters)).toBe(false);
        expect(taskFiltersActive({...emptyTaskFilters, search: " a "})).toBe(true);
    });
    it("names the group option and the empty group", () => {
        expect(groupName({GroupID: noGroupID, GroupName: ""})).toBe("Без групи");
        expect(groupOptions([{GroupID: "g1", GroupName: "Web", Tasks: 1, Attempts: 1, TeamsTried: 1, Solves: 1, SolveRate: 1}]).map(o => o.label)).toEqual(["Усі групи", "Web"]);
    });
});

describe("totals and verdicts", () => {
    it("counts solved tasks, mismatches and hints", () => {
        const rows = [row(), row({Solves: 0, HintsOpened: 1, HintPoints: 5, Calibration: {Verdict: "too_hard", ExpectedMin: 0, ExpectedMax: 1}})];
        expect(taskTotals(rows)).toEqual({tasks: 2, solved: 1, mismatches: 1, hints: 3, hintPoints: 25});
    });
    it("flags only real mismatches", () => {
        expect(isMismatch("too_easy")).toBe(true);
        expect(isMismatch("insufficient")).toBe(false);
        expect(verdictTone("too_hard")).toBe("ib-tag--danger");
        expect(verdictTone("insufficient")).toBe("");
    });
    it("labels a missing difficulty", () => expect(difficultyLabel("")).toBe("Не вказана"));
});

describe("calibration chart", () => {
    it("draws a band per known difficulty and a dot per tried task", () => {
        const rows = [row(), row({ChallengeID: "c2", Difficulty: "hard", TeamsTried: 0, Calibration: {Verdict: "insufficient", ExpectedMin: 0.1, ExpectedMax: 0.45}})];
        expect(calibrationHasData(rows)).toBe(true);
        const option = calibrationChartOption(rows) as {xAxis: {data: string[]}; series: {type: string; data: unknown[]}[]};
        expect(option.xAxis.data).toEqual(["легке", "складне"]);
        expect(option.series.map(s => s.type)).toEqual(["bar", "bar", "scatter"]);
        expect(option.series[2].data).toHaveLength(1);
        expect(option.series[0].data).toEqual([55, 10]);
        expect(option.series[1].data).toEqual([35, 35]);
    });
    it("has nothing to draw while no team has tried a task", () => expect(calibrationHasData([row({TeamsTried: 0})])).toBe(false));
});

describe("solves chart", () => {
    const detail = (points: {Attempts: number; Solves: number}[]) => ({
        Task: row(), Series: points.map((p, i) => ({At: `2026-09-29T10:0${i * 5}:00Z`, Correct: 0, Opens: 0, ...p})), FailedTeams: [], HintEffect: {With: {}, Without: {}},
        Period: {From: "2026-09-29T10:00:00Z", To: "2026-09-29T10:15:00Z"}, RefreshedAt: null, Final: false,
    }) as unknown as AnalyticsTaskDetail;
    it("accumulates the solves", () => {
        const option = solvesChartOption(detail([{Attempts: 2, Solves: 1}, {Attempts: 1, Solves: 0}, {Attempts: 3, Solves: 2}])) as {series: {data: number[][]}[]};
        expect(option.series[0].data.map(point => point[1])).toEqual([1, 1, 3]);
        expect(option.series[1].data.map(point => point[1])).toEqual([2, 1, 3]);
    });
    it("is empty without attempts or solves", () => {
        expect(detailHasActivity(detail([{Attempts: 0, Solves: 0}]))).toBe(false);
        expect(detailHasActivity(detail([{Attempts: 1, Solves: 0}]))).toBe(true);
    });
});
