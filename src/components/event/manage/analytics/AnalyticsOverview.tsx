"use client";

import {useMemo, useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {getAnalyticsOverview, type AnalyticsFeedItem, type AnalyticsOverview as Overview} from "@/api/manageAnalytics";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {activityBucketMinutes, activityChartOption} from "./activityChart";
import {percent, seriesHasActivity, type ChartState} from "./analyticsModel";
import {AnalyticsChart} from "./AnalyticsChart";
import {AnalyticsExportButton} from "./AnalyticsExportButton";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
import {RegistrationsCard, ScoresCard, useOverviewRegistrations, useOverviewScores} from "./OverviewCharts";
import {CommsCard, EngagementCard, LeadersCard, sectionHref, StandsCard, StatusStrip, TasksCard} from "./OverviewCards";
import {useAnalyticsPeriod} from "./useAnalyticsPeriod";

// Polls a little slower than the server's 10 s report cache.
export const OVERVIEW_POLL_SECONDS = 15;

const number = new Intl.NumberFormat("uk-UA");
const feedTime = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"});

export function feedText(item: AnalyticsFeedItem): string {
    const vars = {team: item.TeamName, challenge: item.ChallengeName};
    switch (item.Kind) {
        case "first_blood": return t("manage.analytics.feed.firstBlood", vars);
        case "stand_failed": return t("manage.analytics.feed.standFailed", vars);
        case "team_created": return t("manage.analytics.feed.teamCreated", vars);
        case "freeze_started": return t("manage.analytics.feed.freezeStarted");
    }
}

// The counters shown before the start: who has registered and how the teams look.
function RegistrationStats({overview, teamMode}: {overview: Overview; teamMode: boolean}) {
    const {Participants: people, Teams: teams} = overview;
    return <AnalyticsStatGrid label={t("manage.analytics.registration.label")}>
        <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.registered")} value={number.format(people.Registered)} hint={t("manage.analytics.stat.registeredHint")} />
        <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.approved")} value={number.format(people.Approved)} hint={t("manage.analytics.stat.approvedHint")} />
        <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.pending")} value={number.format(people.Pending)} hint={t("manage.analytics.stat.pendingHint")} />
        <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.invited")} value={number.format(people.Invited)} hint={t("manage.analytics.stat.invitedHint")} />
        {teamMode && <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.teams")} value={number.format(teams.Total)} note={t("manage.analytics.stat.teamsNote", {admitted: teams.Admitted, incomplete: teams.Incomplete})} hint={t("manage.analytics.stat.teamsHint")} />}
    </AnalyticsStatGrid>;
}

function LiveStats({overview, teamMode}: {overview: Overview; teamMode: boolean}) {
    const {Participants: people, Teams: teams, Stands: stands} = overview;
    const standTotal = stands.Creating + stands.Ready + stands.Failed;
    return <AnalyticsStatGrid label={t("manage.analytics.stats.label")}>
        <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.registered")} value={number.format(people.Registered)} note={t("manage.analytics.stat.registeredNote", {approved: people.Approved})} hint={t("manage.analytics.stat.registeredHint")} />
        <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.active")} value={number.format(people.Active)} hint={t("manage.analytics.stat.activeHint")} />
        {teamMode && <AnalyticsStat href={sectionHref.participants} label={t("manage.analytics.stat.teamsAdmitted")} value={number.format(teams.Admitted)} note={t("manage.analytics.stat.teamsIncomplete", {count: teams.Incomplete})} hint={t("manage.analytics.stat.teamsAdmittedHint")} />}
        <AnalyticsStat href={sectionHref.tasks} label={t("manage.analytics.stat.attempts")} value={number.format(overview.Attempts)} note={t("manage.analytics.stat.attemptsNote", {correct: overview.Correct, share: percent(overview.Correct, overview.Attempts)})} hint={t("manage.analytics.stat.attemptsHint")} />
        <AnalyticsStat href={sectionHref.tasks} label={t("manage.analytics.stat.solves")} value={number.format(overview.Solves)} hint={t("manage.analytics.stat.solvesHint")} />
        <AnalyticsStat href={sectionHref.tasks} label={t("manage.analytics.stat.hints")} value={number.format(overview.HintsOpened)} note={t("manage.analytics.stat.hintsNote", {points: number.format(overview.HintPoints)})} hint={t("manage.analytics.stat.hintsHint")} />
        {standTotal > 0 && <AnalyticsStat href={sectionHref.stands} label={t("manage.analytics.stat.stands")} value={number.format(stands.Ready)} note={t("manage.analytics.stat.standsNote", {failed: stands.Failed, creating: stands.Creating})} hint={t("manage.analytics.stat.standsHint")} />}
    </AnalyticsStatGrid>;
}

function Feed({overview, state, onRetry, error}: {error?: unknown; overview?: Overview; state: "loading" | "error" | "ready"; onRetry: () => void}) {
    const {event} = useManager();
    const items = overview?.Feed ?? [];
    return <section className="event-analytics__block" aria-label={t("manage.analytics.feed.title")}>
        <div className="event-analytics__block-head"><h2>{t("manage.analytics.feed.title")}</h2><p>{t("manage.analytics.feed.subtitle")}</p></div>
        <div className="event-analytics-feed">
            {state === "loading" && <EventLoading event={event} label={t("manage.analytics.feed.loading")} />}
            {state === "error" && <EventLoadError message={t("manage.analytics.feed.loadFailed")} onRetry={onRetry} error={error} />}
            {state === "ready" && items.length === 0 && <EmptyState message={t("manage.analytics.feed.empty")} />}
            {state === "ready" && items.length > 0 && <ol>{items.map(item => <li className="event-analytics-feed__item" key={`${item.Kind}-${item.At}-${item.TeamID ?? ""}-${item.ChallengeName}`}>
                <time className="event-analytics-feed__time" dateTime={item.At}>{feedTime.format(new Date(item.At))}</time>
                <span className="event-analytics-feed__text">{feedText(item)}{item.Detail && <small>{item.Detail}</small>}</span>
            </li>)}</ol>}
        </div>
    </section>;
}

// «Огляд» (§6.1): a status strip (countdown, progress or duration), the
// counters, the activity chart with the start / freeze / finish / now markers,
// the feed of notable moments, and a grid of cards: leaders, tasks, engagement,
// stands and mail. Before the start it shows the registration counters and the
// stands and mail cards. Every card keeps its size through loading, empty and
// error. Setup lives in the «Підготовка заходу» wizard.
export function AnalyticsOverview() {
    const {event} = useManager();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const filter = useAnalyticsPeriod();
    const overview = useQuery({
        queryKey: ["event-analytics-overview", eventID, filter.period.from, filter.period.to],
        queryFn: () => getAnalyticsOverview(eventID, filter.period),
        // A final report does not change; a running event is re-read.
        refetchInterval: query => query.state.data?.Final ? false : OVERVIEW_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        // Changing the period keeps the page, and its filter, in place.
        placeholderData: keepPreviousData,
    });
    const data = overview.data;
    const updatedAt = overview.dataUpdatedAt;
    // "Now" is the moment of the last answer; the poll moves it every few seconds.
    // The phase comes from the event itself, so the layout is the same before and after the data.
    const [mountedAt] = useState(() => Date.now());
    const started = Date.parse(event.StartTime) <= (updatedAt || mountedAt);
    const scores = useOverviewScores(filter.period, !!data?.Final);
    const registrations = useOverviewRegistrations(!started);
    const chartState: ChartState = overview.isPending ? "loading" : !data ? "error" : seriesHasActivity(data.Series) ? "ready" : "empty";
    const chartOption = useMemo(() => data && seriesHasActivity(data.Series) ? activityChartOption(data, data.Final ? undefined : updatedAt) : undefined, [data, updatedAt]);
    const retry = () => void overview.refetch();

    const status = <LiveStatus freshness={data?.Final ? {kind: "manual", onRefresh: () => void overview.refetch(), refreshing: overview.isFetching} : {kind: "polling", seconds: OVERVIEW_POLL_SECONDS, failing: overview.isError}} updatedAt={updatedAt} />;
    const actions = <>{status}<AnalyticsExportButton eventID={eventID} section="overview" period={filter.period} disabled={!data} /></>;
    const cards = {event, overview: data, state: "ready", onRetry: retry, error: overview.error, teamMode, notStarted: !started} as const;
    // Stands appear only for an event that has them, mail only for the sensitive access.
    const hasStands = !!data && data.Stands.Creating + data.Stands.Ready + data.Stands.Failed > 0;
    const hasComms = !!data?.Comms;
    const title = t("manage.analytics.overview.title");
    const description = t(started ? "manage.analytics.overview.description" : "manage.analytics.overview.descriptionBefore");

    // The overview is one request: its first load is one loader and its failure one error,
    // both centred in a block as tall as the page content. Polling keeps the data on screen.
    if (!data) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block event-analytics__block--page">
            {overview.isPending ? <EventLoading event={event} label={t("manage.analytics.overview.loading")} /> : <EventLoadError message={t("manage.analytics.overview.loadFailed")} error={overview.error} onRetry={retry} />}
        </div>
    </AnalyticsPage>;
    // The charts' own requests run beside it; the page shows once they have answered too.
    if (scores.isPending || (!started && registrations.isPending)) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block event-analytics__block--page"><EventLoading event={event} label={t("manage.analytics.overview.loading")} /></div>
    </AnalyticsPage>;

    return <AnalyticsPage title={title} description={description} actions={actions} filter={started ? <AnalyticsPeriodFilter period={filter} /> : undefined}>
        <StatusStrip overview={data} />
        {started ? <LiveStats overview={data} teamMode={teamMode} /> : <RegistrationStats overview={data} teamMode={teamMode} />}
        <div className="event-analytics-charts">
            {started ? <section className="event-analytics__block" aria-label={t("manage.analytics.chart.title")}>
                <div className="event-analytics__block-head"><h2>{t("manage.analytics.chart.title")}</h2><p>{t("manage.analytics.chart.subtitle", {minutes: activityBucketMinutes(data)})}</p></div>
                <AnalyticsChart event={event} state={chartState} option={chartOption}
                    ariaLabel={t("manage.analytics.chart.title")} loadingLabel={t("manage.analytics.chart.loading")} errorMessage={t("manage.analytics.chart.loadFailed")}
                    emptyMessage={t("manage.analytics.chart.empty")} onRetry={retry} error={overview.error} />
            </section> : <RegistrationsCard query={registrations} />}
            <ScoresCard query={scores} final={data.Final} />
        </div>
        <div className="event-analytics-cards">
            <LeadersCard {...cards} />
            <Feed overview={data} state="ready" onRetry={retry} error={overview.error} />
            <TasksCard {...cards} />
            <EngagementCard {...cards} />
            {hasStands && <StandsCard {...cards} />}
            {hasComms && <CommsCard {...cards} />}
        </div>
    </AnalyticsPage>;
}
