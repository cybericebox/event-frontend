import type {AnalyticsStands} from "@/api/manageAnalyticsStands";
import {t} from "@/i18n/t";
import {formatDuration} from "./analyticsFormat";

// Same look as the results chart: slate axes and grid, the event palette, the
// tooltip following the axis, zoom with the wheel or the slider.
const axisText = "var(--ib-chart-axis)";
const barColor = "var(--ib-s1)";

// Deploy time per team, fastest first; the median is drawn as a dashed line.
export function standsChartOption(stands: AnalyticsStands) {
    const rows = stands.Teams.flatMap(team => team.DeploySeconds === null ? [] : [{name: team.TeamName, seconds: team.DeploySeconds}])
        .sort((a, b) => a.seconds - b.seconds);
    const median = stands.Summary.DeployMedianSeconds;
    return {
        grid: {left: 56, right: 16, top: 24, bottom: rows.length > 12 ? 64 : 40},
        tooltip: {trigger: "axis", axisPointer: {type: "line"}, valueFormatter: (value: number) => formatDuration(value)},
        xAxis: {type: "category", data: rows.map(row => row.name), axisLine: {lineStyle: {color: "var(--ib-chart-line)"}}, axisLabel: {color: axisText, hideOverlap: true}},
        yAxis: {type: "value", min: 0, axisLabel: {color: axisText, formatter: (value: number) => formatDuration(value)}, splitLine: {lineStyle: {color: "var(--ib-chart-grid)"}}},
        dataZoom: rows.length > 12 ? [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}] : [],
        series: [{
            name: t("manage.analytics.stands.chart.series"), type: "bar", color: barColor, data: rows.map(row => row.seconds), barMaxWidth: 36,
            markLine: median === null ? undefined : {
                silent: true, symbol: "none", lineStyle: {type: "dashed", color: axisText},
                label: {formatter: t("manage.analytics.stands.chart.median", {value: formatDuration(median)}), color: axisText},
                data: [{yAxis: median}],
            },
        }],
    };
}
