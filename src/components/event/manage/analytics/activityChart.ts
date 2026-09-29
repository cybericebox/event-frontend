import type {AnalyticsOverview} from "@/api/manageAnalytics";
import {bucketSeries, visibleMarkers, type ChartMarker} from "./analyticsModel";
import {t} from "@/i18n/t";

// Same look as the results chart (ScoreChart): the slate axes and grid, the
// event palette. Lines are smooth, the tooltip follows the axis, and the plot
// zooms with the wheel or the slider.
const axisText = "#64748b";
const palette = {attempts: "#0091EA", correct: "#1E2A6B", solves: "#22C55E", wrong: "#EF4444", opens: "#F59E0B"};

export function lifecycleMarkers(markers: AnalyticsOverview["Markers"]): ChartMarker[] {
    return [
        {at: markers.StartAt, label: t("manage.analytics.marker.start")},
        {at: markers.FreezeAt, label: t("manage.analytics.marker.freeze")},
        {at: markers.FinishAt, label: t("manage.analytics.marker.finish")},
    ];
}

export type ActivitySeries = {
    name: string; type: "line"; smooth: boolean; showSymbol: boolean; color: string; lineStyle: {width: number}; emphasis: {focus: string};
    data: number[][];
    markLine?: {silent: boolean; symbol: string; lineStyle: object; label: object; data: {name: string; xAxis: number}[]};
};

// The whole-event activity: solves and wrong attempts per bucket, with start /
// freeze / finish (and «зараз», when `now` is given) marked. Attempts, correct
// answers and task opens start hidden in the legend. A long event is merged
// into wider buckets (see activityBucketMinutes).
export const activityBucketMinutes = (overview: AnalyticsOverview) => bucketSeries(overview.Series).minutes;

export function activityChartOption(overview: AnalyticsOverview, now?: number) {
    const from = Date.parse(overview.Period.From);
    const to = Date.parse(overview.Period.To);
    const {points} = bucketSeries(overview.Series);
    const line = (name: string, color: string, pick: (point: AnalyticsOverview["Series"][number]) => number, extra: Partial<ActivitySeries> = {}): ActivitySeries => ({
        name, type: "line" as const, smooth: true, showSymbol: false, color, lineStyle: {width: 2}, emphasis: {focus: "series"},
        data: points.map(point => [Date.parse(point.At), pick(point)]), ...extra,
    });
    const moments: ChartMarker[] = [...lifecycleMarkers(overview.Markers), ...(now === undefined ? [] : [{at: new Date(now).toISOString(), label: t("manage.analytics.marker.now")}])];
    const marks = visibleMarkers(moments, overview.Period.From, overview.Period.To);
    const attemptsName = t("manage.analytics.series.attempts");
    const correctName = t("manage.analytics.series.correct");
    const opensName = t("manage.analytics.series.opens");
    return {
        grid: {left: 44, right: 16, top: 36, bottom: 64},
        legend: {type: "scroll", top: 0, textStyle: {color: axisText}, selected: {[attemptsName]: false, [correctName]: false, [opensName]: false}},
        tooltip: {trigger: "axis"},
        xAxis: {type: "time", min: from, max: Math.max(to, from + 1), axisLine: {lineStyle: {color: "#cbd5e1"}}, axisLabel: {color: axisText}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: "#e2e8f0"}}},
        dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}],
        series: [
            line(t("manage.analytics.series.solves"), palette.solves, point => point.Solves, {
                markLine: {
                    silent: true, symbol: "none", lineStyle: {type: "dashed", color: axisText},
                    label: {formatter: "{b}", color: axisText},
                    data: marks.map(marker => ({name: marker.label, xAxis: marker.at})),
                },
            }),
            line(t("manage.analytics.series.wrong"), palette.wrong, point => Math.max(0, point.Attempts - point.Correct)),
            line(attemptsName, palette.attempts, point => point.Attempts),
            line(correctName, palette.correct, point => point.Correct),
            line(opensName, palette.opens, point => point.Opens),
        ],
    };
}
