"use client";

import ReactECharts from "echarts-for-react";
import type {ManageResultsSnapshot} from "@/api/manageResults";

export function ScoreChart({snapshot, startTime, finishTime}: {
    snapshot: ManageResultsSnapshot;
    startTime: Date;
    finishTime: Date;
}) {
    const series = snapshot.Scoreboard.slice(0, 5).map(team => {
        let points = 0;
        const solves = snapshot.Timeline.filter(item => item.EventTeamID === team.TeamID).sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
        return {name: team.TeamName, type: "line", smooth: true, showSymbol: false, data: [
            [startTime.getTime(), 0],
            ...solves.map(item => [Date.parse(item.SolvedAt), points += item.Points]),
        ]};
    });
    const option = {
        color: ["#1E2A6B", "#0091EA", "#3B82F6", "#22C55E", "#F59E0B"],
        grid: {left: 44, right: 16, top: 28, bottom: 28},
        legend: {orient: "horizontal", top: 0, textStyle: {color: "#64748b"}},
        xAxis: {type: "time", min: startTime.getTime(), max: Math.max(finishTime.getTime(), startTime.getTime() + 1), axisLine: {lineStyle: {color: "#cbd5e1"}}, axisLabel: {color: "#64748b"}, splitLine: {show: false}},
        yAxis: {type: "value", axisLabel: {color: "#64748b"}, splitLine: {lineStyle: {color: "#e2e8f0"}}},
        tooltip: {trigger: "axis"},
        series,
    };
    return <ReactECharts style={{height: 300, width: "100%"}} option={option} notMerge />;
}
