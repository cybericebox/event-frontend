import type {AnalyticsHeatmap, AnalyticsInactive, AnalyticsMatrix, AnalyticsScores} from "@/api/manageAnalyticsTasks";
import {t} from "@/i18n/t";

// Pure helpers of «Прогрес» (§6.4): the score chart, the matrix cells, the
// heatmap and the inactive teams. Chart colours and axes follow the results
// chart (scoreboard/ScoreChart).
const axisText = "var(--ib-dim)";
const gridLine = "var(--ib-line)";
const axisLine = "var(--ib-control)";
export const scorePalette = ["#1E2A6B", "#0091EA", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444", "var(--ib-dim)"];

export const TOP_OPTIONS = [5, 10, 20] as const;
export const DEFAULT_TOP = 10;
export const MAX_CHOSEN_TEAMS = 20;
export const INACTIVE_OPTIONS = [15, 30, 60, 120, 240] as const;
export const DEFAULT_INACTIVE_MINUTES = 30;

export const scoresHaveData = (scores: AnalyticsScores) => scores.Series.some(series => series.Points.length > 1 || (series.Points[0]?.Score ?? 0) > 0);

// Every team's running score as a smooth monotone line (a score changes at a solve or a
// hint), in the ranking order, with the wheel / slider zoom.
export function scoreChartOption(scores: AnalyticsScores) {
    const from = Date.parse(scores.Period.From);
    const to = Date.parse(scores.Period.To);
    return {
        color: scorePalette,
        grid: {left: 44, right: 16, top: 36, bottom: 64},
        legend: {type: "scroll", top: 0, textStyle: {color: axisText}},
        tooltip: {trigger: "axis"},
        xAxis: {type: "time", min: from, max: Math.max(to, from + 1), axisLine: {lineStyle: {color: axisLine}}, axisLabel: {color: axisText}, splitLine: {show: false}},
        yAxis: {type: "value", axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}],
        series: scores.Series.map(series => ({
            name: series.Name, type: "line", smooth: true, smoothMonotone: "x", showSymbol: false, lineStyle: {width: 2}, emphasis: {focus: "series"},
            data: series.Points.map(point => [Date.parse(point.At), point.Score]),
        })),
    };
}

// Teams the chart can still add: not drawn yet, best first.
export function pickableTeams(scores: AnalyticsScores | undefined, chosen: string[]): {value: string; label: string}[] {
    return (scores?.Teams ?? []).filter(team => !team.Selected && !chosen.includes(team.TeamID)).map(team => ({value: team.TeamID, label: team.Name}));
}

export type MatrixCellKind = "solved" | "tried" | "untouched";
export type MatrixCell = {kind: MatrixCellKind; attempts: number; solvedAt: string | null};

const untouched: MatrixCell = {kind: "untouched", attempts: 0, solvedAt: null};

// team × task -> cell; the API lists only the touched ones.
export function matrixIndex(matrix: AnalyticsMatrix): (teamID: string, challengeID: string) => MatrixCell {
    const cells = new Map<string, MatrixCell>();
    for (const cell of matrix.Cells) {
        cells.set(`${cell.TeamID}:${cell.ChallengeID}`, cell.SolvedAt ? {kind: "solved", attempts: cell.Attempts, solvedAt: cell.SolvedAt} : {kind: "tried", attempts: cell.Attempts, solvedAt: null});
    }
    return (teamID, challengeID) => cells.get(`${teamID}:${challengeID}`) ?? untouched;
}

export function filterMatrixTeams(teams: AnalyticsMatrix["Teams"], search: string): AnalyticsMatrix["Teams"] {
    const needle = search.trim().toLocaleLowerCase("uk");
    return needle ? teams.filter(team => team.Name.toLocaleLowerCase("uk").includes(needle)) : teams;
}

export const matrixHasData = (matrix: AnalyticsMatrix) => matrix.Tasks.length > 0 && matrix.Teams.length > 0;

const hourLabel = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});
export const heatmapHasData = (heatmap: AnalyticsHeatmap) => heatmap.Cells.length > 0 && heatmap.MaxActivity > 0;

// Team × hour: darker is busier. A long team list is scrolled by a vertical
// slider (the first teams in view), so the block keeps its size.
export function heatmapOption(heatmap: AnalyticsHeatmap, visibleTeams = 14) {
    const hours = heatmap.Hours.map(hour => hourLabel.format(new Date(hour)));
    const hourIndex = new Map(heatmap.Hours.map((hour, index) => [Date.parse(hour), index]));
    const teamIndex = new Map(heatmap.Teams.map((team, index) => [team.TeamID, index]));
    const data = heatmap.Cells.flatMap(cell => {
        const x = hourIndex.get(Date.parse(cell.HourAt));
        const y = teamIndex.get(cell.TeamID);
        return x === undefined || y === undefined ? [] : [{value: [x, y, cell.Activity], attempts: cell.Attempts, opens: cell.Opens, solves: cell.Solves}];
    });
    const zoomed = heatmap.Teams.length > visibleTeams;
    return {
        grid: {left: 120, right: zoomed ? 44 : 16, top: 12, bottom: 84},
        tooltip: {
            formatter: (params: {data?: {value: number[]; attempts: number; opens: number; solves: number}}) => {
                const cell = params.data;
                if (!cell) return "";
                const team = heatmap.Teams[cell.value[1]]?.Name ?? "";
                return `${team}<br/>${hours[cell.value[0]] ?? ""}<br/>${t("manage.analytics.progress.heatmap.tooltip", {attempts: cell.attempts, opens: cell.opens, solves: cell.solves})}`;
            },
        },
        xAxis: {type: "category", data: hours, splitArea: {show: false}, axisLine: {lineStyle: {color: axisLine}}, axisLabel: {color: axisText, hideOverlap: true}},
        // Best team on top.
        yAxis: {type: "category", data: heatmap.Teams.map(team => team.Name), inverse: true, axisLine: {lineStyle: {color: axisLine}}, axisLabel: {color: axisText, width: 100, overflow: "truncate"}},
        visualMap: {min: 0, max: Math.max(heatmap.MaxActivity, 1), calculable: false, orient: "horizontal", left: "center", bottom: 30, itemHeight: 140, textStyle: {color: axisText}, inRange: {color: ["#E6F4FE", "#0091EA", "#1E2A6B"]}},
        dataZoom: zoomed ? [
            {type: "slider", yAxisIndex: 0, right: 8, width: 16, startValue: 0, endValue: visibleTeams - 1, filterMode: "none"},
            {type: "inside", yAxisIndex: 0, filterMode: "none", zoomOnMouseWheel: false, moveOnMouseWheel: true},
        ] : [],
        series: [{type: "heatmap", data, emphasis: {itemStyle: {borderColor: "#1E2A6B", borderWidth: 1}}}],
    };
}

export const inactiveMinutesLabel = (minutes: number) =>
    minutes >= 60 && minutes % 60 === 0 ? t("manage.analytics.progress.inactive.hours", {hours: minutes / 60}) : t("manage.analytics.progress.inactive.minutes", {minutes});

export const inactiveHasTeams = (inactive: AnalyticsInactive) => inactive.Teams.length > 0;
