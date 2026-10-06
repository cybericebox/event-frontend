import type {AnalyticsReport, FunnelStep} from "@/api/manageAnalyticsReport";
import {t} from "@/i18n/t";
import {formatCount} from "./analyticsFormat";

// The report's charts share the results chart's look: slate axes and grid, the
// event palette, tooltips following the axis. They are static pictures of a
// finished event, so no live behaviour beyond hover and zoom.
const axisText = "var(--ib-chart-axis)";
const palette = {primary: "var(--ib-s1)", navy: "var(--ib-s4)", ok: "var(--ib-ok)", warn: "var(--ib-warn)"};
const axisLine = {lineStyle: {color: "var(--ib-chart-line)"}};
const gridLine = {lineStyle: {color: "var(--ib-chart-grid)"}};

const clip = (name: string, max = 22) => name.length > max ? `${name.slice(0, max - 1)}…` : name;

// Horizontal bars, first step on top.
export function funnelOption(steps: FunnelStep[], group: "participants" | "teams") {
    const rows = steps.map(step => ({name: t(`manage.analytics.report.funnel.${group}.${step.Key}`), value: step.Count}));
    return {
        grid: {left: 8, right: 48, top: 8, bottom: 8, containLabel: true},
        tooltip: {trigger: "axis", axisPointer: {type: "line"}},
        xAxis: {type: "value", minInterval: 1, axisLabel: {color: axisText}, splitLine: gridLine},
        yAxis: {type: "category", inverse: true, data: rows.map(row => row.name), axisLine, axisLabel: {color: axisText}},
        series: [{type: "bar", color: palette.primary, barMaxWidth: 28, data: rows.map(row => row.value), label: {show: true, position: "right", color: axisText, formatter: ({value}: {value: number}) => formatCount(value)}}],
    };
}

// The best teams by points.
export function rankingOption(report: AnalyticsReport, limit = 10) {
    const rows = report.Ranking.slice(0, limit);
    return {
        grid: {left: 8, right: 48, top: 8, bottom: 8, containLabel: true},
        tooltip: {trigger: "axis", axisPointer: {type: "line"}},
        xAxis: {type: "value", min: 0, axisLabel: {color: axisText}, splitLine: gridLine},
        yAxis: {type: "category", inverse: true, data: rows.map(row => clip(row.Name)), axisLine, axisLabel: {color: axisText}},
        series: [{name: t("manage.analytics.report.col.points"), type: "bar", color: palette.navy, barMaxWidth: 24, data: rows.map(row => row.Points), label: {show: true, position: "right", color: axisText}}],
    };
}

// Share of the teams that tried a task and solved it, per task.
export function taskRatesOption(report: AnalyticsReport) {
    const rows = report.TaskRows;
    const many = rows.length > 12;
    return {
        grid: {left: 44, right: 16, top: 16, bottom: many ? 72 : 48, containLabel: true},
        tooltip: {trigger: "axis", axisPointer: {type: "line"}, valueFormatter: (value: number) => `${Math.round(value)}%`},
        xAxis: {type: "category", data: rows.map(row => clip(row.Name, 16)), axisLine, axisLabel: {color: axisText, interval: 0, rotate: many ? 40 : 0, hideOverlap: true}},
        yAxis: {type: "value", min: 0, max: 100, axisLabel: {color: axisText, formatter: "{value}%"}, splitLine: gridLine},
        dataZoom: many ? [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}] : [],
        series: [{name: t("manage.analytics.report.col.solveRate"), type: "bar", color: palette.ok, barMaxWidth: 32, data: rows.map(row => Math.round(row.SolveRate * 100))}],
    };
}

const HOUR = 3_600_000;

// The 5-minute series folded into buckets: 5 minutes up to half a day, then hours.
export function bucketedActivity(report: AnalyticsReport): {at: number; attempts: number; solves: number}[] {
    const points = report.Series;
    if (points.length === 0) return [];
    const span = Date.parse(points[points.length - 1].At) - Date.parse(points[0].At);
    const size = span > 12 * HOUR ? HOUR : 300_000;
    const buckets = new Map<number, {at: number; attempts: number; solves: number}>();
    for (const point of points) {
        const at = Math.floor(Date.parse(point.At) / size) * size;
        const bucket = buckets.get(at) ?? {at, attempts: 0, solves: 0};
        bucket.attempts += point.Attempts;
        bucket.solves += point.Solves;
        buckets.set(at, bucket);
    }
    return [...buckets.values()].sort((a, b) => a.at - b.at);
}

export function reportHasActivity(report: AnalyticsReport): boolean {
    return report.Series.some(point => point.Attempts + point.Solves > 0);
}

export function reportActivityOption(report: AnalyticsReport) {
    const buckets = bucketedActivity(report);
    const line = (name: string, color: string, pick: (bucket: (typeof buckets)[number]) => number) => ({
        name, type: "line" as const, smooth: true, showSymbol: false, color, lineStyle: {width: 2}, emphasis: {focus: "series"},
        data: buckets.map(bucket => [bucket.at, pick(bucket)]),
    });
    return {
        grid: {left: 44, right: 16, top: 36, bottom: 64},
        legend: {type: "scroll", top: 0, textStyle: {color: "var(--ib-chart-legend)"}},
        tooltip: {trigger: "axis"},
        xAxis: {type: "time", axisLine, axisLabel: {color: axisText}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: gridLine},
        dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}],
        series: [
            line(t("manage.analytics.series.attempts"), palette.primary, bucket => bucket.attempts),
            line(t("manage.analytics.series.solves"), palette.ok, bucket => bucket.solves),
        ],
    };
}
