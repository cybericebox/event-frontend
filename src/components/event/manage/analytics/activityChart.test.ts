import {describe, expect, it} from "vitest";
import {AnalyticsOverviewSchema} from "@/api/manageAnalytics";
import {activityChartOption} from "./activityChart";

const overview = AnalyticsOverviewSchema.parse({
    Participants: {Registered: 0, Approved: 0, Pending: 0, Invited: 0, Active: 0},
    Teams: {Total: 0, Admitted: 0, Incomplete: 0}, Attempts: 0, Correct: 0, Solves: 0, HintsOpened: 0, HintPoints: 0,
    Stands: {Creating: 0, Ready: 0, Failed: 0},
    Series: [{At: "2026-09-29T10:00:00Z", Attempts: 3, Correct: 1, Solves: 1, Opens: 2}, {At: "2026-09-29T10:05:00Z", Attempts: 0, Correct: 0, Solves: 0, Opens: 0}],
    Feed: [],
    Markers: {StartAt: "2026-09-29T10:00:00Z", FreezeAt: "2026-09-29T13:00:00Z", FinishAt: "2026-09-29T14:00:00Z"},
    Period: {From: "2026-09-29T10:00:00Z", To: "2026-09-29T10:10:00Z"},
});

describe("activity chart", () => {
    const option = activityChartOption(overview);

    it("draws smooth lines with zoom and an axis tooltip", () => {
        expect(option.series.every(series => series.smooth)).toBe(true);
        expect(option.dataZoom.map(zoom => zoom.type)).toEqual(["inside", "slider"]);
        expect(option.tooltip.trigger).toBe("axis");
        expect(option.series[0].data).toEqual([[Date.parse("2026-09-29T10:00:00Z"), 3], [Date.parse("2026-09-29T10:05:00Z"), 0]]);
    });

    it("marks only the lifecycle moments inside the period", () => {
        const marks = option.series[0].markLine?.data ?? [];
        expect(marks).toHaveLength(1);
        expect(marks[0].xAxis).toBe(Date.parse("2026-09-29T10:00:00Z"));
    });

    it("keeps the noisy task opens hidden until asked", () => {
        const selected = Object.values(option.legend.selected);
        expect(selected).toEqual([false]);
    });
});
