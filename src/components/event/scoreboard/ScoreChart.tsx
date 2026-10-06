"use client";

import {useRef, useState} from "react";
import ReactECharts from "echarts-for-react";
import {t} from "@/i18n/t";
import {useChartTokens} from "@/components/event/charts/chartTokens";
import {holdPoints} from "@/components/event/charts/holdPoints";
import {chartOwn, chartSeries} from "@/components/event/charts/chartTheme";
import type {ManageResultsSnapshot} from "@/api/manageResults";


// `note` is written over the plot (before the start, or with nobody to
// chart): the axes stay, so the block keeps its place and size.
type ChartInput = {snapshot: ManageResultsSnapshot; teamIDs: string[]; ownTeamID?: string; startTime: Date; finishTime: Date; note?: string};

// Smooth monotone lines (never stepped, never above a team's real score) with a wheel / pinch / drag zoom and a slim slider on the time axis.
export function scoreChartOption({snapshot, teamIDs, ownTeamID, startTime, finishTime, note}: ChartInput) {
    const series = teamIDs.map(teamID => snapshot.Scoreboard.find(team => team.TeamID === teamID)).filter(team => !!team).map(team => {
        let points = 0;
        const solves = snapshot.Timeline.filter(item => item.EventTeamID === team.TeamID).sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
        const own = team.TeamID === ownTeamID;
        return {name: team.TeamName, type: "line", smooth: true, smoothMonotone: "x", showSymbol: false, ...(own ? {color: chartOwn} : {}), lineStyle: {width: own ? 3 : 2}, z: own ? 3 : 2, data: holdPoints([
            [startTime.getTime(), 0],
            ...solves.map((item): [number, number] => [Date.parse(item.SolvedAt), points += item.Points]),
            [finishTime.getTime(), points],
        ])};
    });
    return {
        color: chartSeries,
        grid: {left: 44, right: 16, top: 36, bottom: 56},
        legend: {type: "scroll", orient: "horizontal", top: 0, textStyle: {color: "var(--ib-chart-legend)"}},
        xAxis: {type: "time", min: startTime.getTime(), max: Math.max(finishTime.getTime(), startTime.getTime() + 1), axisLine: {lineStyle: {color: "var(--ib-chart-line)"}}, axisLabel: {color: "var(--ib-chart-axis)"}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, max: series.length === 0 || note ? 100 : undefined, axisLabel: {color: "var(--ib-chart-axis)"}, splitLine: {lineStyle: {color: "var(--ib-chart-grid)"}}},
        graphic: note ? [{type: "text", left: "center", top: "middle", silent: true, style: {text: note, fill: "var(--ib-chart-axis)", fontSize: 14}}] : [],
        tooltip: {trigger: "axis"},
        // Slider colours are DS tokens, resolved per theme by useChartTokens.
        dataZoom: [
            {type: "inside", xAxisIndex: 0, filterMode: "none"},
            {type: "slider", xAxisIndex: 0, filterMode: "none", height: 16, bottom: 8, borderColor: "transparent", backgroundColor: "var(--ib-chart-grid)", fillerColor: "var(--ib-chart-line)", handleSize: "100%", handleStyle: {color: "var(--ib-dim)", borderColor: "transparent"}, moveHandleSize: 0, showDetail: false, dataBackground: {lineStyle: {opacity: 0}, areaStyle: {opacity: 0}}, selectedDataBackground: {lineStyle: {opacity: 0}, areaStyle: {opacity: 0}}},
        ],
        series,
    };
}

export function ScoreChart(input: ChartInput) {
    const chart = useRef<ReactECharts>(null);
    const option = useChartTokens(scoreChartOption(input));
    const [zoomed, setZoomed] = useState(false);
    const reset = () => {
        chart.current?.getEchartsInstance().dispatchAction({type: "dataZoom", start: 0, end: 100});
        setZoomed(false);
    };
    const onZoom = (event: {batch?: {start: number; end: number}[]; start?: number; end?: number}) => {
        const zoom = event.batch?.[0] ?? event;
        setZoomed((zoom.start ?? 0) > 0.01 || (zoom.end ?? 100) < 99.99);
    };
    return <div className="event-score-chart">
        <ReactECharts ref={chart} style={{height: 320, width: "100%"}} option={option} notMerge onEvents={{datazoom: onZoom, dblclick: reset}} />
        {zoomed && <button type="button" className="ib-btn ib-btn--sm event-score-chart__reset" onClick={reset}>{t("scoreboard.chartResetZoom")}</button>}
    </div>;
}
