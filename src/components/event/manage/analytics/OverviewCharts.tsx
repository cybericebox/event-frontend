"use client";

import {useMemo} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import type {AnalyticsPeriod} from "@/api/manageAnalytics";
import {getAnalyticsParticipants, type AnalyticsParticipants} from "@/api/manageAnalyticsPeople";
import {getAnalyticsScores, type AnalyticsScores} from "@/api/manageAnalyticsTasks";
import {useManager} from "@/components/event/manage/ManagerShell";
import {t} from "@/i18n/t";
import {AnalyticsBlock} from "./AnalyticsBlock";
import {AnalyticsChart} from "./AnalyticsChart";
import {visibleMarkers, type ChartState} from "./analyticsModel";
import {scoreChartOption, scoresHaveData} from "./progress/progressModel";
import {registrationsHaveData} from "./peopleModel";

const POLL_SECONDS = 15;
export const LEADER_LINES = 5;
const axisText = "#64748b";
const palette = {total: "#1E2A6B", open: "#0091EA", approval: "#22C55E", invitation: "#F59E0B"};

// The score chart of the top teams as smooth lines (the Live «Динаміка балів»
// data), with «Зараз» while the event runs.
export function scoresOverviewOption(scores: AnalyticsScores, now?: number) {
    const option = scoreChartOption(scores);
    const marks = now === undefined ? [] : visibleMarkers([{at: new Date(now).toISOString(), label: t("manage.analytics.marker.now")}], scores.Period.From, scores.Period.To);
    return {
        ...option,
        series: option.series.map((series, index) => ({
            ...series, step: undefined, smooth: true,
            ...(index === 0 && marks.length > 0 ? {markLine: {silent: true, symbol: "none", lineStyle: {type: "dashed", color: axisText}, label: {formatter: "{b}", color: axisText}, data: marks.map(mark => ({name: mark.label, xAxis: mark.at}))}} : {}),
        })),
    };
}

// Registrations by day, added up: the total and each channel.
export function registrationsOverviewOption(registrations: AnalyticsParticipants["Registrations"]) {
    const running = (pick: (day: AnalyticsParticipants["Registrations"]["Days"][number]) => number) => {
        let sum = 0;
        return registrations.Days.map(day => [Date.parse(day.Day), (sum += pick(day))]);
    };
    const line = (name: string, color: string, data: number[][], width = 2) => ({name, type: "line" as const, smooth: true, showSymbol: false, color, lineStyle: {width}, emphasis: {focus: "series"}, data});
    return {
        grid: {left: 44, right: 16, top: 36, bottom: 64},
        legend: {type: "scroll", top: 0, textStyle: {color: axisText}},
        tooltip: {trigger: "axis"},
        xAxis: {type: "time", axisLine: {lineStyle: {color: "#cbd5e1"}}, axisLabel: {color: axisText}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, minInterval: 1, axisLabel: {color: axisText}, splitLine: {lineStyle: {color: "#e2e8f0"}}},
        dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}],
        series: [
            line(t("manage.analytics.overviewCharts.registrations.total"), palette.total, running(day => day.Open + day.Approval + day.Invitation), 3),
            line(t("manage.analytics.people.channel.open"), palette.open, running(day => day.Open)),
            line(t("manage.analytics.people.channel.approval"), palette.approval, running(day => day.Approval)),
            line(t("manage.analytics.people.channel.invitation"), palette.invitation, running(day => day.Invitation)),
        ],
    };
}

const stateOf = (pending: boolean, data: unknown, hasData: boolean): ChartState => pending ? "loading" : !data ? "error" : hasData ? "ready" : "empty";

// «Динаміка балів»: the top teams' running score. Its own query, its own states.
export function ScoresCard({period, final}: {period: AnalyticsPeriod; final: boolean}) {
    const {event} = useManager();
    const query = useQuery({
        queryKey: ["event-analytics-overview-scores", event.EventID, period.from, period.to, LEADER_LINES],
        queryFn: () => getAnalyticsScores(event.EventID, period, LEADER_LINES, []),
        refetchInterval: final ? false : POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });
    const {data, dataUpdatedAt} = query;
    const ready = !!data && scoresHaveData(data);
    const option = useMemo(() => data && scoresHaveData(data) ? scoresOverviewOption(data, final ? undefined : dataUpdatedAt) : undefined, [data, final, dataUpdatedAt]);
    return <AnalyticsBlock title={t("manage.analytics.overviewCharts.scores.title")} subtitle={t("manage.analytics.overviewCharts.scores.subtitle", {count: LEADER_LINES})} hint={t("manage.analytics.overviewCharts.scores.hint")}>
        <AnalyticsChart event={event} state={stateOf(query.isPending, data, ready)} option={ready ? option : undefined}
            ariaLabel={t("manage.analytics.overviewCharts.scores.title")} loadingLabel={t("manage.analytics.overviewCharts.scores.loading")} errorMessage={t("manage.analytics.overviewCharts.scores.loadFailed")}
            emptyMessage={t("manage.analytics.overviewCharts.scores.empty")} onRetry={() => void query.refetch()} error={query.error} />
    </AnalyticsBlock>;
}

// «Реєстрації»: before the start, instead of the (empty) activity chart.
export function RegistrationsCard() {
    const {event} = useManager();
    const query = useQuery({
        queryKey: ["event-analytics-overview-registrations", event.EventID],
        queryFn: () => getAnalyticsParticipants(event.EventID),
        refetchInterval: POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
    });
    const data = query.data;
    const ready = !!data && registrationsHaveData(data.Registrations);
    return <AnalyticsBlock title={t("manage.analytics.overviewCharts.registrations.title")} subtitle={t("manage.analytics.overviewCharts.registrations.subtitle")} hint={t("manage.analytics.overviewCharts.registrations.hint")}>
        <AnalyticsChart event={event} state={stateOf(query.isPending, data, ready)} option={ready ? registrationsOverviewOption(data.Registrations) : undefined}
            ariaLabel={t("manage.analytics.overviewCharts.registrations.title")} loadingLabel={t("manage.analytics.overviewCharts.registrations.loading")} errorMessage={t("manage.analytics.overviewCharts.registrations.loadFailed")}
            emptyMessage={t("manage.analytics.overviewCharts.registrations.empty")} onRetry={() => void query.refetch()} error={query.error} />
    </AnalyticsBlock>;
}
