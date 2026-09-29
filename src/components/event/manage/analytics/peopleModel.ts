import type {
    AnalyticsBucket, AnalyticsCommsType, AnalyticsParticipants, AnalyticsQuestion, FunnelStage,
} from "@/api/manageAnalyticsPeople";
import {t} from "@/i18n/t";
import {percent} from "./analyticsModel";

// Chart look shared with the results chart (see activityChart.ts): slate axes
// and grid, the event palette, tooltip on the axis.
const axisText = "#64748b";
const gridLine = "#e2e8f0";
const palette = {main: "#0091EA", navy: "#1E2A6B", green: "#22C55E", amber: "#F59E0B", red: "#EF4444"};

const axisLine = {lineStyle: {color: "#cbd5e1"}};
const baseGrid = {left: 44, right: 16, top: 24, bottom: 32, containLabel: true};

export const stageLabel = (stage: FunnelStage) => t(`manage.analytics.people.stage.${stage}`);

export type FunnelRow = {stage: FunnelStage; label: string; count: number; ofPrevious: string; ofFirst: string};

// Every stage with its share of the previous stage and of the first one. Stages
// are not strict subsets (open registration is never «invited»), so the shares
// are reading aids, not a conversion guarantee.
export function funnelRows(stages: AnalyticsParticipants["Funnel"]): FunnelRow[] {
    const first = stages.find(stage => stage.Stage === "registered")?.Count ?? stages[0]?.Count ?? 0;
    return stages.map((stage, index) => ({
        stage: stage.Stage, label: stageLabel(stage.Stage), count: stage.Count,
        ofPrevious: index === 0 ? "—" : percent(stage.Count, stages[index - 1].Count),
        ofFirst: stage.Stage === "invited" ? "—" : percent(stage.Count, first),
    }));
}

export const funnelHasData = (stages: AnalyticsParticipants["Funnel"]) => stages.some(stage => stage.Count > 0);

export function funnelChartOption(stages: AnalyticsParticipants["Funnel"]) {
    const rows = funnelRows(stages);
    return {
        grid: {...baseGrid, left: 12, right: 48},
        tooltip: {
            trigger: "axis", axisPointer: {type: "line"},
            formatter: (params: {dataIndex: number}[]) => {
                const row = rows[params[0].dataIndex];
                return `${row.label}: <b>${row.count}</b><br/>${t("manage.analytics.people.funnel.ofPrevious")}: ${row.ofPrevious}`;
            },
        },
        xAxis: {type: "value", minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        yAxis: {type: "category", inverse: true, data: rows.map(row => row.label), axisLine, axisLabel: {color: axisText}},
        series: [{type: "bar", barMaxWidth: 28, color: palette.main, label: {show: true, position: "right", color: axisText}, data: rows.map(row => row.count)}],
    };
}

const channelColor = {open: palette.main, approval: palette.navy, invitation: palette.amber};

export const registrationsHaveData = (registrations: AnalyticsParticipants["Registrations"]) => registrations.Total > 0;

// Registrations per UTC day, stacked by channel; wheel or slider zooms.
export function registrationsChartOption(registrations: AnalyticsParticipants["Registrations"]) {
    const days = registrations.Days.map(day => Date.parse(day.Day));
    const bars = (name: string, color: string, pick: (day: AnalyticsParticipants["Registrations"]["Days"][number]) => number) => ({
        name, type: "bar", stack: "channel", color, emphasis: {focus: "series"},
        data: registrations.Days.map((day, index) => [days[index], pick(day)]),
    });
    return {
        grid: {...baseGrid, bottom: 64},
        legend: {type: "scroll", top: 0, textStyle: {color: axisText}},
        tooltip: {trigger: "axis", axisPointer: {type: "line"}},
        xAxis: {type: "time", axisLine, axisLabel: {color: axisText}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}],
        series: [
            bars(t("manage.analytics.people.channel.open"), channelColor.open, day => day.Open),
            bars(t("manage.analytics.people.channel.approval"), channelColor.approval, day => day.Approval),
            bars(t("manage.analytics.people.channel.invitation"), channelColor.invitation, day => day.Invitation),
        ],
    };
}

export const fillHasData = (teams: AnalyticsParticipants["Teams"]) => teams.Total > 0;

// Teams by size; the bars below the minimum are the incomplete ones.
export function fillChartOption(teams: AnalyticsParticipants["Teams"]) {
    return {
        grid: baseGrid,
        tooltip: {trigger: "axis", axisPointer: {type: "line"}, formatter: (params: {name: string; value: number}[]) => t("manage.analytics.people.fill.tooltip", {members: params[0].name, teams: params[0].value})},
        xAxis: {type: "category", name: t("manage.analytics.people.fill.axis"), nameLocation: "middle", nameGap: 28, nameTextStyle: {color: axisText}, data: teams.Histogram.map(bucket => String(bucket.Members)), axisLine, axisLabel: {color: axisText}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        series: [{
            type: "bar", barMaxWidth: 40,
            data: teams.Histogram.map(bucket => ({value: bucket.Teams, itemStyle: {color: bucket.Members < teams.MinSize ? palette.amber : palette.main}})),
        }],
    };
}

// The bucket labels the server sends as codes.
export function bucketLabel(question: AnalyticsQuestion, bucket: AnalyticsBucket): string {
    if (question.Input === "checkbox") return t(bucket.Label === "yes" ? "manage.analytics.people.answer.yes" : "manage.analytics.people.answer.no");
    if (question.Input === "file") return t(bucket.Label === "has" ? "manage.analytics.people.answer.fileHas" : "manage.analytics.people.answer.fileNone");
    return bucket.Label;
}

export const timelineInputs = new Set(["date"]);
export const listInputs = new Set(["text", "long_text"]);

export function questionHasData(question: AnalyticsQuestion): boolean {
    return question.Buckets.some(bucket => bucket.Count > 0);
}

// One question's chart: bars for choices, checkbox, file and number ranges, a
// smooth line for a date timeline.
export function questionChartOption(question: AnalyticsQuestion) {
    const labels = question.Buckets.map(bucket => bucketLabel(question, bucket));
    const counts = question.Buckets.map(bucket => bucket.Count);
    const tooltip = {trigger: "axis", axisPointer: {type: "line"}};
    const yAxis = {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}};
    if (timelineInputs.has(question.Input)) {
        return {
            grid: baseGrid, tooltip: {trigger: "axis"}, yAxis,
            xAxis: {type: "category", data: labels, boundaryGap: false, axisLine, axisLabel: {color: axisText}},
            dataZoom: [{type: "inside", filterMode: "none"}],
            series: [{type: "line", smooth: true, showSymbol: counts.length < 40, color: palette.main, lineStyle: {width: 2}, areaStyle: {opacity: 0.08}, data: counts}],
        };
    }
    const categories = question.Input === "select" || question.Input === "multi_select";
    return {
        grid: baseGrid, tooltip, yAxis,
        xAxis: {type: "category", data: labels, axisLine, axisLabel: {color: axisText, interval: 0, width: 90, overflow: "truncate"}},
        series: [{type: "bar", barMaxWidth: 40, color: categories ? palette.navy : palette.main, data: counts}],
    };
}

export type QuestionShape = "chart" | "list";

export const questionShape = (question: AnalyticsQuestion): QuestionShape => listInputs.has(question.Input) ? "list" : "chart";

export const formatRate = (rate: number | null) => rate === null ? "—" : `${Math.round(rate * 100)}%`;

export const commsHasData = (totals: AnalyticsCommsType) =>
    totals.EmailSent + totals.EmailErrors + totals.InAppSent + totals.InAppErrors + totals.InAppCreated > 0;

// The label of a notification type: the settings-page title when there is one,
// else the raw code.
export function notificationTypeLabel(type: string): string {
    if (!type) return t("manage.analytics.comms.type.none");
    const key = `manage.notifications.signal.${type}.title`;
    const label = t(key);
    return label === key ? type : label;
}

// Sent and failed per type, mail and in-app stacked side by side.
export function commsChartOption(types: AnalyticsCommsType[]) {
    const top = types.slice(0, 12);
    const names = top.map(type => notificationTypeLabel(type.Type));
    const bars = (name: string, color: string, stack: string, pick: (type: AnalyticsCommsType) => number) => ({
        name, type: "bar", stack, color, emphasis: {focus: "series"}, barMaxWidth: 28, data: top.map(pick),
    });
    return {
        grid: {...baseGrid, bottom: 40},
        legend: {type: "scroll", top: 0, textStyle: {color: axisText}},
        tooltip: {trigger: "axis", axisPointer: {type: "line"}},
        xAxis: {type: "category", data: names, axisLine, axisLabel: {color: axisText, interval: 0, width: 96, overflow: "truncate"}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: gridLine}}},
        series: [
            bars(t("manage.analytics.comms.series.emailSent"), palette.main, "email", type => type.EmailSent),
            bars(t("manage.analytics.comms.series.emailErrors"), palette.red, "email", type => type.EmailErrors),
            bars(t("manage.analytics.comms.series.inAppSent"), palette.green, "inApp", type => type.InAppSent),
            bars(t("manage.analytics.comms.series.inAppErrors"), palette.amber, "inApp", type => type.InAppErrors),
        ],
    };
}
