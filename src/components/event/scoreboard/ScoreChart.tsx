"use client"

import ReactECharts from "echarts-for-react"
import { IActiveChartSeriesItem } from "@/types/event"

interface ScoreChartProps {
    series: IActiveChartSeriesItem[]
    startTime: Date
    finishTime: Date
}

// Visual-match component for the scoreboard's "top-5 score over time" line chart.
// Indigo-Frost palette below is hardcoded hex because ECharts cannot read CSS
// custom properties; kept to the small, named set the prototype uses.
export function ScoreChart({ series, startTime, finishTime }: ScoreChartProps) {
    const option = {
        color: ["#1E2A6B", "#0091EA", "#3B82F6", "#22C55E", "#F59E0B"],
        grid: { left: 44, right: 16, top: 28, bottom: 28 },
        legend: { orient: "horizontal", top: 0, textStyle: { color: "#64748b" } },
        xAxis: {
            type: "time",
            min: startTime.getTime(),
            max: finishTime.getTime(),
            axisLine: { lineStyle: { color: "#cbd5e1" } },
            axisLabel: { color: "#64748b" },
            splitLine: { show: false },
        },
        yAxis: {
            type: "value",
            axisLabel: { color: "#64748b" },
            splitLine: { lineStyle: { color: "#e2e8f0" } },
        },
        tooltip: { trigger: "axis" },
        series: series.map((s) => ({
            name: s.name,
            type: "line",
            data: s.data,
            smooth: true,
            showSymbol: false,
        })),
    }

    return <ReactECharts style={{ height: 300, width: "100%" }} option={option} notMerge />
}
