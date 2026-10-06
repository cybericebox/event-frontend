import {t} from "@/i18n/t";
import {holdPoints} from "@/components/event/charts/holdPoints";
import type {CategoryShare, PointsPoint} from "./participationStatsModel";

// Same look as the analytics charts: slate axes and grid, the tooltip follows
// the axis. The lines take the event accent.
const axisText = "var(--ib-chart-axis)";
const axisLine = "var(--ib-chart-line)";
const gridLine = "var(--ib-chart-grid)";
const secondary = "var(--ib-chart-axis)";

export type PointsSeries = {name: string; points: PointsPoint[]; color: string; dashed?: boolean};

// Running points over time: a smooth line per series, a step to the end of the window so the last value holds.
export function pointsChartOption(series: readonly PointsSeries[], window: {from: number; to: number}) {
    return {
        grid: {left: 44, right: 16, top: series.length > 1 ? 36 : 16, bottom: 28},
        legend: series.length > 1 ? {type: "scroll", top: 0, textStyle: {color: "var(--ib-chart-legend)"}} : undefined,
        tooltip: {trigger: "axis"},
        xAxis: {type: "time", min: window.from, max: window.to, axisLine: {lineStyle: {color: axisLine}}, axisLabel: {color: axisText, hideOverlap: true}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        series: series.map(item => {
            const last = item.points[item.points.length - 1]?.[1] ?? 0;
            return {
                name: item.name, type: "line", smooth: true, smoothMonotone: "x", showSymbol: false, color: item.color,
                lineStyle: {width: item.dashed ? 2 : 3, type: item.dashed ? "dashed" : "solid"}, emphasis: {focus: "series"},
                data: holdPoints([[window.from, 0], ...item.points, [window.to, last]]),
            };
        }),
    };
}

// Solves per category as horizontal bars; the tooltip adds the points.
export function categoryChartOption(shares: readonly CategoryShare[], color: string) {
    const rows = [...shares].reverse();
    return {
        grid: {left: 8, right: 24, top: 8, bottom: 8, containLabel: true},
        tooltip: {
            trigger: "axis", axisPointer: {type: "none"},
            formatter: (params: {dataIndex: number}[]) => {
                const share = rows[params[0].dataIndex];
                return `${share.category}<br/>${t("participation.chart.category.tooltip", {solves: share.solves, points: share.points})}`;
            },
        },
        xAxis: {type: "value", minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        yAxis: {type: "category", data: rows.map(row => row.category), axisLine: {lineStyle: {color: axisLine}}, axisTick: {show: false}, axisLabel: {color: axisText, width: 120, overflow: "truncate"}},
        series: [{type: "bar", color, barMaxWidth: 22, data: rows.map(row => row.solves), itemStyle: {borderRadius: [0, 4, 4, 0]}}],
    };
}

export const memberLineColor = secondary;
