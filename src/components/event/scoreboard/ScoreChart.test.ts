import {describe, expect, it} from "vitest";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import {scoreChartOption} from "./ScoreChart";
import {pointsChartOption} from "@/components/event/participation/participationCharts";
import {scoreChartOption as progressOption} from "@/components/event/manage/analytics/progress/progressModel";

const team = "00000000-0000-4000-8000-000000000001";
const snapshot = {
    Scoreboard: [{Rank: 1, TeamID: team, TeamName: "Альфа", Points: 300, Solved: 2, LastSolveAt: null}],
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
        expect(option.series[0].data.map(point => point[1])).toEqual([0, 100, 300, 300]);
    });

    it("participation and analytics score charts are smooth monotone too", () => {
        const own = pointsChartOption([{name: "A", color: "#000", points: [[1, 5]]}], {from: 0, to: 10});
        expect(own.series[0]).toMatchObject({smooth: true, smoothMonotone: "x"});
        const progress = progressOption({Period: {From: "2026-10-01T10:00:00Z", To: "2026-10-01T12:00:00Z"}, Series: [{Name: "A", Points: [{At: "2026-10-01T11:00:00Z", Score: 5}]}]} as never);
        expect(progress.series[0]).toMatchObject({smooth: true, smoothMonotone: "x"});
        expect(progress.series[0]).not.toHaveProperty("step");
    });
});
