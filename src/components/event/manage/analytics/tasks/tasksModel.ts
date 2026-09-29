import {noGroupID, type AnalyticsGroupRow, type AnalyticsTaskDetail, type AnalyticsTaskRow, type CalibrationVerdict} from "@/api/manageAnalyticsTasks";
import {t} from "@/i18n/t";

// Pure helpers of «Завдання» (§6.3): formatting, filters, totals and the chart
// options. Chart colours and axes follow the results chart.
const axisText = "#64748b";
const gridLine = "#e2e8f0";
const axisLine = "#cbd5e1";
const palette = {ok: "#22C55E", tooEasy: "#F59E0B", tooHard: "#EF4444", neutral: "#94a3b8", band: "#0091EA", solves: "#22C55E", attempts: "#0091EA"};

export const difficultyOrder = ["trivial", "easy", "medium", "hard", "insane"] as const;

export const difficultyLabel = (difficulty: string) =>
    (difficultyOrder as readonly string[]).includes(difficulty) ? t(`manage.exercises.difficulty.${difficulty}`) : t("manage.analytics.tasks.difficultyUnknown");

export const formatPercent = (rate: number) => `${Math.round(rate * 100)}%`;

// 45 с, 12 хв, 2 год 05 хв, 1 д 3 год; "—" when there is nothing to measure.
export function formatDuration(seconds: number | null): string {
    if (seconds === null) return "—";
    const total = Math.max(0, Math.round(seconds));
    if (total < 60) return t("manage.analytics.duration.seconds", {seconds: total});
    const minutes = Math.floor(total / 60);
    if (minutes < 60) return t("manage.analytics.duration.minutes", {minutes});
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("manage.analytics.duration.hours", {hours, minutes: String(minutes % 60).padStart(2, "0")});
    return t("manage.analytics.duration.days", {days: Math.floor(hours / 24), hours: hours % 24});
}

export const verdictLabel = (verdict: CalibrationVerdict) => t(`manage.analytics.tasks.verdict.${verdict}`);
export const isMismatch = (verdict: CalibrationVerdict) => verdict === "too_easy" || verdict === "too_hard";

// The tag class of a verdict: a mismatch is flagged, an unjudged task is neutral.
export function verdictTone(verdict: CalibrationVerdict): string {
    switch (verdict) {
        case "ok": return "ib-tag--ok";
        case "too_easy": return "ib-tag--warn";
        case "too_hard": return "ib-tag--danger";
        default: return "";
    }
}

export type VerdictFilter = "all" | "mismatch" | "too_easy" | "too_hard";
export type TaskFilters = {search: string; group: string; verdict: VerdictFilter};
export const allGroups = "all";
export const emptyTaskFilters: TaskFilters = {search: "", group: allGroups, verdict: "all"};
export const taskFiltersActive = (filters: TaskFilters) => filters.search.trim() !== "" || filters.group !== allGroups || filters.verdict !== "all";

export function filterTasks(rows: AnalyticsTaskRow[], filters: TaskFilters): AnalyticsTaskRow[] {
    const needle = filters.search.trim().toLocaleLowerCase("uk");
    return rows.filter(row => {
        if (needle && !row.Name.toLocaleLowerCase("uk").includes(needle)) return false;
        if (filters.group !== allGroups && row.GroupID !== filters.group) return false;
        switch (filters.verdict) {
            case "mismatch": return isMismatch(row.Calibration.Verdict);
            case "too_easy": case "too_hard": return row.Calibration.Verdict === filters.verdict;
            default: return true;
        }
    });
}

export const groupName = (group: {GroupID: string; GroupName: string}) => group.GroupID === noGroupID || !group.GroupName ? t("manage.analytics.tasks.noGroup") : group.GroupName;

export function groupOptions(groups: AnalyticsGroupRow[]): {value: string; label: string}[] {
    return [{value: allGroups, label: t("manage.analytics.tasks.filter.allGroups")}, ...groups.map(group => ({value: group.GroupID, label: groupName(group)}))];
}

export const verdictOptions = (): {value: VerdictFilter; label: string}[] => [
    {value: "all", label: t("manage.analytics.tasks.filter.allVerdicts")},
    {value: "mismatch", label: t("manage.analytics.tasks.filter.mismatch")},
    {value: "too_easy", label: t("manage.analytics.tasks.verdict.too_easy")},
    {value: "too_hard", label: t("manage.analytics.tasks.verdict.too_hard")},
];

export type TaskTotals = {tasks: number; solved: number; mismatches: number; hints: number; hintPoints: number};

export function taskTotals(rows: AnalyticsTaskRow[]): TaskTotals {
    return rows.reduce<TaskTotals>((totals, row) => ({
        tasks: totals.tasks + 1,
        solved: totals.solved + (row.Solves > 0 ? 1 : 0),
        mismatches: totals.mismatches + (isMismatch(row.Calibration.Verdict) ? 1 : 0),
        hints: totals.hints + row.HintsOpened,
        hintPoints: totals.hintPoints + row.HintPoints,
    }), {tasks: 0, solved: 0, mismatches: 0, hints: 0, hintPoints: 0});
}

// Something to draw: at least one task that a team has tried.
export const calibrationHasData = (rows: AnalyticsTaskRow[]) => rows.some(row => row.TeamsTried > 0);

const verdictColor = (verdict: CalibrationVerdict) =>
    verdict === "ok" ? palette.ok : verdict === "too_easy" ? palette.tooEasy : verdict === "too_hard" ? palette.tooHard : palette.neutral;

// Declared difficulty (x) against the real solve rate (y): the expected band of
// each difficulty as a bar, every task tried by a team as a dot coloured by its
// verdict. A dot outside its band is a mismatch.
export function calibrationChartOption(rows: AnalyticsTaskRow[]) {
    const known = difficultyOrder.filter(difficulty => rows.some(row => row.Difficulty === difficulty));
    const labels = known.map(difficultyLabel);
    const bands = known.map(difficulty => rows.find(row => row.Difficulty === difficulty && row.Calibration.Verdict !== "unknown")?.Calibration);
    const dots = rows.filter(row => row.TeamsTried > 0 && known.includes(row.Difficulty as typeof known[number])).map(row => ({
        value: [difficultyLabel(row.Difficulty), Math.round(row.SolveRate * 100)],
        name: row.Name, tried: row.TeamsTried, solved: row.Solves, verdict: row.Calibration.Verdict,
        itemStyle: {color: verdictColor(row.Calibration.Verdict)},
    }));
    const bandName = t("manage.analytics.tasks.calibration.band");
    return {
        grid: {left: 44, right: 16, top: 36, bottom: 32},
        legend: {top: 0, textStyle: {color: axisText}, data: [bandName]},
        tooltip: {
            trigger: "item",
            formatter: (params: {seriesType?: string; data?: {name?: string; tried?: number; solved?: number; value?: (string | number)[]; verdict?: CalibrationVerdict}}) => {
                const data = params.data;
                if (params.seriesType !== "scatter" || !data?.name) return "";
                return `${data.name}<br/>${t("manage.analytics.tasks.calibration.tooltip", {rate: data.value?.[1] ?? 0, solved: data.solved ?? 0, tried: data.tried ?? 0})}`;
            },
        },
        xAxis: {type: "category", data: labels, axisLine: {lineStyle: {color: axisLine}}, axisLabel: {color: axisText}},
        yAxis: {type: "value", min: 0, max: 100, axisLabel: {color: axisText, formatter: "{value}%"}, splitLine: {lineStyle: {color: gridLine}}},
        series: [
            {name: bandName, type: "bar", stack: "band", silent: true, itemStyle: {color: "transparent"}, tooltip: {show: false}, data: bands.map(band => band ? Math.round(band.ExpectedMin * 100) : 0)},
            {name: bandName, type: "bar", stack: "band", silent: true, barWidth: "46%", itemStyle: {color: palette.band, opacity: 0.16}, tooltip: {show: false},
                data: bands.map(band => band ? Math.round((band.ExpectedMax - band.ExpectedMin) * 100) : 0)},
            {name: t("manage.analytics.tasks.calibration.tasks"), type: "scatter", symbolSize: 12, z: 3, data: dots},
        ],
    };
}

export const detailHasActivity = (detail: AnalyticsTaskDetail) => detail.Series.some(point => point.Attempts + point.Solves > 0);

// One task's solves over time (running total) and attempts per 5 minutes, with
// the wheel / slider zoom of the results chart.
export function solvesChartOption(detail: AnalyticsTaskDetail) {
    const from = Date.parse(detail.Period.From);
    const to = Date.parse(detail.Period.To);
    let solved = 0;
    const running = detail.Series.map(point => [Date.parse(point.At), solved += point.Solves]);
    const line = (name: string, color: string, data: number[][], extra: object = {}) => ({
        name, type: "line", smooth: true, showSymbol: false, color, lineStyle: {width: 2}, emphasis: {focus: "series"}, data, ...extra,
    });
    return {
        grid: {left: 44, right: 16, top: 36, bottom: 64},
        legend: {type: "scroll", top: 0, textStyle: {color: axisText}},
        tooltip: {trigger: "axis"},
        xAxis: {type: "time", min: from, max: Math.max(to, from + 1), axisLine: {lineStyle: {color: axisLine}}, axisLabel: {color: axisText}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}],
        series: [
            line(t("manage.analytics.tasks.detail.series.solves"), palette.solves, running, {areaStyle: {opacity: 0.08}}),
            line(t("manage.analytics.tasks.detail.series.attempts"), palette.attempts, detail.Series.map(point => [Date.parse(point.At), point.Attempts])),
        ],
    };
}
