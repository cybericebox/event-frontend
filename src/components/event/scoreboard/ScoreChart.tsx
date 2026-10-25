"use client";

import {useMemo, useRef, useState} from "react";
import ReactECharts from "echarts-for-react";
import {Download, Minus, Plus, RotateCcw, type LucideIcon} from "lucide-react";
import {t} from "@/i18n/t";
import {resolveToken, useChartTokens, useResolvedToken} from "@/components/event/charts/chartTokens";
import {teamColors} from "@/components/event/charts/teamColors";
import {chartOwn, chartSeries} from "@/components/event/charts/chartTheme";
import {EventTooltip} from "@/components/ui/EventTooltip";
import type {ManageResultsSnapshot} from "@/api/manageResults";


// `note` is written over the plot (before the start, or with nobody to
// chart): the axes stay, so the block keeps its place and size.
type ChartInput = {snapshot: ManageResultsSnapshot; teamIDs: string[]; ownTeamID?: string; startTime: Date; finishTime: Date; note?: string};
// `colors`: the team line colours (teamColors), the same as on the live screen; the viewer's own team outside the top
// 15 has none and takes the accent.

// Smooth monotone lines between recorded cumulative scores, with wheel / pinch / drag zoom and a time slider.
export function scoreChartOption({snapshot, teamIDs, ownTeamID, startTime, finishTime, note, colors}: ChartInput & {colors?: Map<string, string>}) {
    const series = teamIDs.map(teamID => snapshot.Scoreboard.find(team => team.TeamID === teamID)).filter(team => !!team).map(team => {
        let points = 0;
        const solves = snapshot.Timeline.filter(item => item.EventTeamID === team.TeamID).sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
        const own = team.TeamID === ownTeamID;
        const data: [number, number][] = [[startTime.getTime(), 0]];
        const append = (at: number, score: number) => {
            const previous = data[data.length - 1];
            // The axis tooltip must get one value per team, including simultaneous solves and the initial point.
            if (previous[0] === at) previous[1] = score;
            else data.push([at, score]);
        };
        for (const item of solves) append(Date.parse(item.SolvedAt), points += item.Points);
        append(finishTime.getTime(), points);
        return {name: team.TeamName, type: "line", smooth: true, smoothMonotone: "x", showSymbol: false, color: colors?.get(team.TeamID) ?? (own ? chartOwn : undefined), lineStyle: {width: own ? 3 : 2}, z: own ? 3 : 2, data};
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

function ChartControl({label, Icon, onClick, disabled = false}: {label: string; Icon: LucideIcon; onClick: () => void; disabled?: boolean}) {
    return <EventTooltip content={label} placement="bottom" silent>
        {() => <button type="button" className="ib-icon-btn ib-icon-btn--sm" aria-label={label} disabled={disabled} onClick={onClick}><Icon aria-hidden="true" /></button>}
    </EventTooltip>;
}

export function ScoreChart(input: ChartInput & {title?: string}) {
    const chart = useRef<ReactECharts>(null);
    const [range, setRange] = useState({start: 0, end: 100});
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const background = useResolvedToken("var(--ib-surface)");
    const colors = useMemo(() => teamColors(input.snapshot, background), [input.snapshot, background]);
    const base = scoreChartOption({...input, colors});
    const option = useChartTokens({...base, legend: {...base.legend, selected}, dataZoom: base.dataZoom.map(zoom => ({...zoom, minSpan: 1, ...range}))});
    const applyRange = (next: typeof range) => {
        chart.current?.getEchartsInstance().dispatchAction({type: "dataZoom", ...next});
        setRange(next);
    };
    const reset = () => applyRange({start: 0, end: 100});
    const zoomBy = (step: number) => {
        const level = Math.round(10000 / Math.max(1, range.end - range.start));
        const width = 10000 / Math.max(100, Math.min(10000, level + step));
        const start = Math.max(0, Math.min(100 - width, (range.start + range.end - width) / 2));
        applyRange({start, end: start + width});
    };
    const save = () => {
        const instance = chart.current?.getEchartsInstance();
        if (!instance) return;
        const link = document.createElement("a");
        link.href = instance.getDataURL({type: "png", pixelRatio: 2, backgroundColor: resolveToken("var(--ib-surface)"), excludeComponents: ["dataZoom"]});
        link.download = t("scoreboard.chartFilename");
        document.body.append(link); link.click(); link.remove();
    };
    const onZoom = (event: {batch?: {start: number; end: number}[]; start?: number; end?: number}) => {
        const zoom = event.batch?.[0] ?? event;
        setRange(previous => ({start: zoom.start ?? previous.start, end: zoom.end ?? previous.end}));
    };
    const zoomed = range.start > 0.01 || range.end < 99.99;
    return <div className="event-score-chart">
        <div className="event-score-chart__head">
            {input.title && <p className="event-results__chart-title">{input.title}</p>}
            <div className="event-score-chart__actions">
                <ChartControl label={t("scoreboard.chartZoomIn")} Icon={Plus} onClick={() => zoomBy(25)} disabled={range.end - range.start <= 1.01} />
                <ChartControl label={t("scoreboard.chartZoomOut")} Icon={Minus} onClick={() => zoomBy(-25)} disabled={!zoomed} />
                <output className="event-score-chart__zoom" aria-label={t("scoreboard.chartZoomLevel")}>{t("scoreboard.chartZoomPercent", {percent: Math.round(10000 / Math.max(1, range.end - range.start))})}</output>
                <ChartControl label={t("scoreboard.chartResetZoom")} Icon={RotateCcw} onClick={reset} disabled={!zoomed} />
                <ChartControl label={t("scoreboard.chartSave")} Icon={Download} onClick={save} />
            </div>
        </div>
        <ReactECharts ref={chart} style={{height: 320, width: "100%"}} option={option} notMerge onEvents={{datazoom: onZoom, legendselectchanged: (event: {selected: Record<string, boolean>}) => setSelected(event.selected), dblclick: reset}} />
    </div>;
}
