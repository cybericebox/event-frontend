"use client";

import ReactECharts from "echarts-for-react";
import type {ManageResultsSnapshot} from "@/api/manageResults";

const palette = ["#1E2A6B", "#0091EA", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444", "#64748B"];

// `note` is written over the plot (before the start, or with nobody to
// chart): the axes stay, so the block keeps its place and size.
export function ScoreChart({snapshot, teamIDs, ownTeamID, startTime, finishTime, note}: {
    snapshot: ManageResultsSnapshot;
    teamIDs: string[];
    ownTeamID?: string;
    startTime: Date;
    finishTime: Date;
    note?: string;
}) {
    const series = teamIDs.map(teamID => snapshot.Scoreboard.find(team => team.TeamID === teamID)).filter(team => !!team).map(team => {
        let points = 0;
        const solves = snapshot.Timeline.filter(item => item.EventTeamID === team.TeamID).sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
        const own = team.TeamID === ownTeamID;
        return {name: team.TeamName, type: "line", step: "end", showSymbol: false, lineStyle: {width: own ? 4 : 2}, z: own ? 3 : 2, data: [
            [startTime.getTime(), 0],
            ...solves.map(item => [Date.parse(item.SolvedAt), points += item.Points]),
            [finishTime.getTime(), points],
        ]};
    });
    const option = {
        color: palette,
        grid: {left: 44, right: 16, top: 36, bottom: 28},
        legend: {type: "scroll", orient: "horizontal", top: 0, textStyle: {color: "#64748b"}},
        xAxis: {type: "time", min: startTime.getTime(), max: Math.max(finishTime.getTime(), startTime.getTime() + 1), axisLine: {lineStyle: {color: "#cbd5e1"}}, axisLabel: {color: "#64748b"}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, max: series.length === 0 || note ? 100 : undefined, axisLabel: {color: "#64748b"}, splitLine: {lineStyle: {color: "#e2e8f0"}}},
        graphic: note ? [{type: "text", left: "center", top: "middle", silent: true, style: {text: note, fill: "#64748b", fontSize: 14}}] : [],
        tooltip: {trigger: "axis"},
        series,
    };
    return <ReactECharts style={{height: 320, width: "100%"}} option={option} notMerge />;
}
