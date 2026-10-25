import {describe, expect, it} from "vitest";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import {scoreChartOption} from "./ScoreChart";
import {pointsChartOption} from "@/components/event/participation/participationCharts";
import {scoreChartOption as progressOption} from "@/components/event/manage/analytics/progress/progressModel";

const team = "00000000-0000-4000-8000-000000000001";
const snapshot = {
    Scoreboard: [{Rank: 1, TeamID: team, TeamName: "Альфа", Points: 300, Solved: 2}],
    Timeline: [{EventTeamID: team, SolvedAt: "2026-10-01T10:30:00Z", Points: 100}, {EventTeamID: team, SolvedAt: "2026-10-01T11:00:00Z", Points: 200}],
} as unknown as ManageResultsSnapshot;
const start = new Date("2026-10-01T10:00:00Z");
const finish = new Date("2026-10-01T12:00:00Z");

describe("score charts are smooth monotone curves", () => {
    it("results chart: smooth + smoothMonotone, no step, zoom inside and a slider on the time axis", () => {
        const option = scoreChartOption({snapshot, teamIDs: [team], startTime: start, finishTime: finish});
        for (const series of option.series) {
            expect(series.smooth).toBe(true);
            expect(series.smoothMonotone).toBe("x");
            expect(series).not.toHaveProperty("step");
        }
        expect(option.dataZoom.map(zoom => zoom.type)).toEqual(["inside", "slider"]);
        expect(option.dataZoom.every(zoom => zoom.xAxisIndex === 0)).toBe(true);
        expect(option.series[0].data).toEqual([
            [start.getTime(), 0],
            [Date.parse("2026-10-01T10:30:00Z"), 100],
            [Date.parse("2026-10-01T11:00:00Z"), 300],
            [finish.getTime(), 300],
        ]);
    });

    it("has one cumulative value per team and instant when the first solve coincides with the chart start", () => {
        const at = "2026-10-01T10:00:00Z";
        const sameInstant = {...snapshot, Timeline: [
            {...snapshot.Timeline[0], SolvedAt: at, Points: 100},
            {...snapshot.Timeline[1], SolvedAt: at, Points: 200},
        ]};
        const option = scoreChartOption({snapshot: sameInstant, teamIDs: [team], startTime: start, finishTime: finish});
        expect(option.series[0].data).toEqual([[start.getTime(), 300], [finish.getTime(), 300]]);
    });

    it("participation and analytics score charts are smooth monotone too", () => {
        const own = pointsChartOption([{name: "A", color: "#000", points: [[1, 5]]}], {from: 0, to: 10});
        expect(own.series[0]).toMatchObject({smooth: true, smoothMonotone: "x"});
        const progress = progressOption({Period: {From: "2026-10-01T10:00:00Z", To: "2026-10-01T12:00:00Z"}, Series: [{Name: "A", Points: [{At: "2026-10-01T11:00:00Z", Score: 5}]}]} as never);
        expect(progress.series[0]).toMatchObject({smooth: true, smoothMonotone: "x"});
        expect(progress.series[0]).not.toHaveProperty("step");
    });
});

describe("results chart team colours", () => {
    it("draws each team in its team colour; the own team outside the top 15 takes the accent", () => {
        const own = "00000000-0000-4000-8000-000000000002";
        const withOwn = {...snapshot, Scoreboard: [...snapshot.Scoreboard, {Rank: 2, TeamID: own, TeamName: "Бета", Points: 0, Solved: 0}]} as unknown as ManageResultsSnapshot;
        const option = scoreChartOption({snapshot: withOwn, teamIDs: [team, own], ownTeamID: own, startTime: start, finishTime: finish, colors: new Map([[team, "#00f000"]])});
        expect(option.series.map(series => series.color)).toEqual(["#00f000", "var(--ib-s-own)"]);
    });
});
