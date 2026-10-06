import {describe, expect, it} from "vitest";
import {AnalyticsHeatmapSchema, AnalyticsMatrixSchema, AnalyticsScoresSchema} from "@/api/manageAnalyticsTasks";
import {filterMatrixTeams, heatmapHasData, heatmapOption, inactiveMinutesLabel, matrixHasData, matrixIndex, pickableTeams, scoreChartOption, scoresHaveData} from "./progressModel";

const period = {From: "2026-09-29T10:00:00Z", To: "2026-09-29T12:00:00Z"};

describe("score chart", () => {
    const scores = AnalyticsScoresSchema.parse({
        Teams: [
            {TeamID: "a", Name: "Blue", Points: 300, Solved: 2, Rank: 1, Hidden: false, Admitted: true, Selected: true},
            {TeamID: "b", Name: "Red", Points: 100, Solved: 1, Rank: 2, Hidden: false, Admitted: true, Selected: false},
        ],
        Series: [{TeamID: "a", Name: "Blue", Points: [{At: "2026-09-29T10:00:00Z", Score: 0}, {At: "2026-09-29T10:30:00Z", Score: 100}, {At: "2026-09-29T12:00:00Z", Score: 100}]}],
        Period: period,
    });
    it("draws a smooth monotone line per selected team", () => {
        const option = scoreChartOption(scores) as {series: {name: string; data: number[][]}[]};
        expect(option.series).toHaveLength(1);
        expect(option.series[0]).toMatchObject({name: "Blue", smooth: true, smoothMonotone: "x"});
        expect(option.series[0].data.map(point => point[1])).toEqual([0, 100, 100]);
        expect(scoresHaveData(scores)).toBe(true);
    });
    it("is empty when every line is flat at zero", () => {
        expect(scoresHaveData({...scores, Series: [{TeamID: "a", Name: "Blue", Points: [{At: period.From, Score: 0}]}]})).toBe(false);
        expect(scoresHaveData({...scores, Series: []})).toBe(false);
    });
    it("offers the teams that are not drawn or chosen yet", () => {
        expect(pickableTeams(scores, [])).toEqual([{value: "b", label: "Red"}]);
        expect(pickableTeams(scores, ["b"])).toEqual([]);
        expect(pickableTeams(undefined, [])).toEqual([]);
    });
});

describe("matrix", () => {
    const matrix = AnalyticsMatrixSchema.parse({
        Tasks: [{ChallengeID: "c1", Name: "Web 1"}, {ChallengeID: "c2", Name: "Pwn 1"}],
        Teams: [{TeamID: "a", Name: "Blue", Points: 100, Solved: 1}, {TeamID: "b", Name: "Red", Points: 0, Solved: 0}],
        Cells: [{TeamID: "a", ChallengeID: "c1", Attempts: 2, SolvedAt: "2026-09-29T10:30:00Z"}, {TeamID: "a", ChallengeID: "c2", Attempts: 4, SolvedAt: null}],
        Period: period,
    });
    it("tells solved, tried and untouched cells", () => {
        const cell = matrixIndex(matrix);
        expect(cell("a", "c1")).toEqual({kind: "solved", attempts: 2, solvedAt: "2026-09-29T10:30:00Z"});
        expect(cell("a", "c2")).toEqual({kind: "tried", attempts: 4, solvedAt: null});
        expect(cell("b", "c1")).toMatchObject({kind: "untouched"});
    });
    it("searches teams and needs both axes to have data", () => {
        expect(filterMatrixTeams(matrix.Teams, " re ").map(team => team.TeamID)).toEqual(["b"]);
        expect(matrixHasData(matrix)).toBe(true);
        expect(matrixHasData({...matrix, Tasks: []})).toBe(false);
    });
});

describe("heatmap", () => {
    const heatmap = AnalyticsHeatmapSchema.parse({
        Hours: ["2026-09-29T10:00:00Z", "2026-09-29T11:00:00Z"],
        Teams: [{TeamID: "a", Name: "Blue", Points: 0, Solved: 0}, {TeamID: "b", Name: "Red", Points: 0, Solved: 0}],
        Cells: [{TeamID: "a", HourAt: "2026-09-29T11:00:00Z", Attempts: 3, Opens: 1, Solves: 1, Activity: 5}, {TeamID: "x", HourAt: "2026-09-29T11:00:00Z", Attempts: 9, Opens: 0, Solves: 0, Activity: 9}],
        MaxActivity: 9, Period: period, RefreshedAt: null, Final: false,
    });
    it("maps a cell to its hour and team and drops an unknown team", () => {
        const option = heatmapOption(heatmap) as {series: {data: {value: number[]}[]}[]; dataZoom: unknown[]; visualMap: {max: number}};
        expect(option.series[0].data.map(item => item.value)).toEqual([[1, 0, 5]]);
        expect(option.visualMap.max).toBe(9);
        expect(option.dataZoom).toEqual([]);
        expect(heatmapHasData(heatmap)).toBe(true);
    });
    it("scrolls a long team list", () => {
        const teams = Array.from({length: 30}, (_, i) => ({TeamID: `t${i}`, Name: `Team ${i}`, Points: 0, Solved: 0}));
        const option = heatmapOption({...heatmap, Teams: teams}, 10) as {dataZoom: {startValue?: number; endValue?: number}[]};
        expect(option.dataZoom[0]).toMatchObject({startValue: 0, endValue: 9});
    });
    it("is empty with no cells", () => expect(heatmapHasData({...heatmap, Cells: [], MaxActivity: 0})).toBe(false));
});

describe("idle threshold label", () => {
    it("uses hours for whole hours", () => {
        expect(inactiveMinutesLabel(30)).toBe("30 хв");
        expect(inactiveMinutesLabel(120)).toBe("2 год");
        expect(inactiveMinutesLabel(90)).toBe("90 хв");
    });
});
