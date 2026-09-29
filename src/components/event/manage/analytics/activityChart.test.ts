import {describe, expect, it} from "vitest";
import {AnalyticsOverviewSchema} from "@/api/manageAnalytics";
import {activityBucketMinutes, activityChartOption} from "./activityChart";

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
        expect(option.series[0].data).toEqual([[Date.parse("2026-09-29T10:00:00Z"), 1], [Date.parse("2026-09-29T10:05:00Z"), 0]]);
    });

    it("draws the solves and the wrong attempts (attempts minus correct)", () => {
        expect(option.series.slice(0, 2).map(series => series.name)).toEqual(["Розв'язання", "Хибні спроби"]);
        expect(option.series[1].data).toEqual([[Date.parse("2026-09-29T10:00:00Z"), 2], [Date.parse("2026-09-29T10:05:00Z"), 0]]);
    });

    it("marks only the lifecycle moments inside the period", () => {
        const marks = option.series[0].markLine?.data ?? [];
        expect(marks).toHaveLength(1);
        expect(marks[0].xAxis).toBe(Date.parse("2026-09-29T10:00:00Z"));
    });

    it("keeps attempts, correct answers and task opens hidden until asked", () => {
        expect(option.legend.selected).toEqual({"Спроби": false, "Правильні": false, "Відкриття завдань": false});
    });

    it("marks «зараз» only when told the moment, and only inside the period", () => {
        const at = Date.parse("2026-09-29T10:07:00Z");
        const marks = activityChartOption(overview, at).series[0].markLine?.data ?? [];
        expect(marks.map(mark => mark.name)).toEqual(["Старт", "Зараз"]);
        expect(activityChartOption(overview, Date.parse("2026-09-29T12:00:00Z")).series[0].markLine?.data).toHaveLength(1);
    });

    it("merges a long event into wider buckets and says how wide", () => {
        expect(activityBucketMinutes(overview)).toBe(5);
        const start = Date.parse("2026-09-29T10:00:00Z");
        const long = {...overview, Series: Array.from({length: 600}, (_, i) => ({At: new Date(start + i * 300_000).toISOString(), Attempts: 1, Correct: 0, Solves: 1, Opens: 0}))};
        expect(activityBucketMinutes(long)).toBe(15);
        const merged = activityChartOption(long).series[0].data;
        expect(merged).toHaveLength(200);
        expect(merged[0]).toEqual([start, 3]);
    });
});
