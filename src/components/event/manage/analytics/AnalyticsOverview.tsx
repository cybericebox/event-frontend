"use client";

import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {getAnalyticsOverview, type AnalyticsFeedItem, type AnalyticsOverview as Overview} from "@/api/manageAnalytics";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {activityChartOption} from "./activityChart";
import {percent, seriesHasActivity, type ChartState} from "./analyticsModel";
import {AnalyticsChart} from "./AnalyticsChart";
import {AnalyticsExportButton} from "./AnalyticsExportButton";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
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
        <AnalyticsStat label={t("manage.analytics.stat.registered")} value={number.format(people.Registered)} hint={t("manage.analytics.stat.registeredHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.approved")} value={number.format(people.Approved)} hint={t("manage.analytics.stat.approvedHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.pending")} value={number.format(people.Pending)} hint={t("manage.analytics.stat.pendingHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.invited")} value={number.format(people.Invited)} hint={t("manage.analytics.stat.invitedHint")} />
        {teamMode && <AnalyticsStat label={t("manage.analytics.stat.teams")} value={number.format(teams.Total)} note={t("manage.analytics.stat.teamsNote", {admitted: teams.Admitted, incomplete: teams.Incomplete})} hint={t("manage.analytics.stat.teamsHint")} />}
    </AnalyticsStatGrid>;
}

function LiveStats({overview, teamMode}: {overview: Overview; teamMode: boolean}) {
    const {Participants: people, Teams: teams, Stands: stands} = overview;
    const standTotal = stands.Creating + stands.Ready + stands.Failed;
    return <AnalyticsStatGrid label={t("manage.analytics.stats.label")}>
        <AnalyticsStat label={t("manage.analytics.stat.registered")} value={number.format(people.Registered)} note={t("manage.analytics.stat.registeredNote", {approved: people.Approved})} hint={t("manage.analytics.stat.registeredHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.active")} value={number.format(people.Active)} hint={t("manage.analytics.stat.activeHint")} />
        {teamMode && <AnalyticsStat label={t("manage.analytics.stat.teamsAdmitted")} value={number.format(teams.Admitted)} note={t("manage.analytics.stat.teamsIncomplete", {count: teams.Incomplete})} hint={t("manage.analytics.stat.teamsAdmittedHint")} />}
        <AnalyticsStat label={t("manage.analytics.stat.attempts")} value={number.format(overview.Attempts)} note={t("manage.analytics.stat.attemptsNote", {correct: overview.Correct, share: percent(overview.Correct, overview.Attempts)})} hint={t("manage.analytics.stat.attemptsHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.solves")} value={number.format(overview.Solves)} hint={t("manage.analytics.stat.solvesHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.hints")} value={number.format(overview.HintsOpened)} note={t("manage.analytics.stat.hintsNote", {points: number.format(overview.HintPoints)})} hint={t("manage.analytics.stat.hintsHint")} />
        {standTotal > 0 && <AnalyticsStat label={t("manage.analytics.stat.stands")} value={number.format(stands.Ready)} note={t("manage.analytics.stat.standsNote", {failed: stands.Failed, creating: stands.Creating})} hint={t("manage.analytics.stat.standsHint")} />}
    </AnalyticsStatGrid>;
}

function Feed({overview, state, onRetry}: {overview?: Overview; state: "loading" | "error" | "ready"; onRetry: () => void}) {
    const {event} = useManager();
    const items = overview?.Feed ?? [];
    return <section className="event-analytics__block" aria-label={t("manage.analytics.feed.title")}>
        <div className="event-analytics__block-head"><h2>{t("manage.analytics.feed.title")}</h2><p>{t("manage.analytics.feed.subtitle")}</p></div>
        <div className="event-analytics-feed">
            {state === "loading" && <EventLoading event={event} label={t("manage.analytics.feed.loading")} />}
            {state === "error" && <EventLoadError message={t("manage.analytics.feed.loadFailed")} onRetry={onRetry} />}
            {state === "ready" && items.length === 0 && <EmptyState message={t("manage.analytics.feed.empty")} />}
            {state === "ready" && items.length > 0 && <ol>{items.map(item => <li className="event-analytics-feed__item" key={`${item.Kind}-${item.At}-${item.TeamID ?? ""}-${item.ChallengeName}`}>
                <time className="event-analytics-feed__time" dateTime={item.At}>{feedTime.format(new Date(item.At))}</time>
                <span className="event-analytics-feed__text">{feedText(item)}{item.Detail && <small>{item.Detail}</small>}</span>
            </li>)}</ol>}
        </div>
    </section>;
}

// «Огляд» (§6.1): counters, the 5-minute activity chart with the start / freeze /
// finish markers, and the feed of notable moments. Before the start it shows
// the registration counters instead. Setup lives in the «Підготовка заходу» wizard.
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
    // "Now" is the moment of the last answer; the poll moves it every few seconds.
    const started = !!data && Date.parse(data.Markers.StartAt) <= overview.dataUpdatedAt;
    const chartState: ChartState = overview.isPending ? "loading" : !data ? "error" : seriesHasActivity(data.Series) ? "ready" : "empty";
    const blockState = overview.isPending ? "loading" : !data ? "error" : "ready";

    const status = <LiveStatus freshness={data?.Final ? {kind: "manual", onRefresh: () => void overview.refetch(), refreshing: overview.isFetching} : {kind: "polling", seconds: OVERVIEW_POLL_SECONDS, failing: overview.isError}} updatedAt={overview.dataUpdatedAt} />;
    const actions = <>{status}<AnalyticsExportButton eventID={eventID} section="overview" period={filter.period} disabled={!data} /></>;

    // Nothing to show before the first answer, and no answer to lean on after a failure.
    if (overview.isPending) return <AnalyticsPage title={t("manage.analytics.overview.title")} description={t("manage.analytics.overview.description")} actions={actions}>
        <div className="event-analytics__block"><EventLoading event={event} label={t("manage.analytics.overview.loading")} /></div>
    </AnalyticsPage>;
    if (!data) return <AnalyticsPage title={t("manage.analytics.overview.title")} description={t("manage.analytics.overview.description")} actions={actions}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.overview.loadFailed")} error={overview.error} onRetry={() => void overview.refetch()} /></div>
    </AnalyticsPage>;

    if (!started) return <AnalyticsPage title={t("manage.analytics.overview.title")} description={t("manage.analytics.overview.descriptionBefore")} actions={actions}>
        <RegistrationStats overview={data} teamMode={teamMode} />
    </AnalyticsPage>;

    return <AnalyticsPage title={t("manage.analytics.overview.title")} description={t("manage.analytics.overview.description")} actions={actions} filter={<AnalyticsPeriodFilter period={filter} />}>
        <LiveStats overview={data} teamMode={teamMode} />
        <div className="event-analytics__columns">
            <section className="event-analytics__block" aria-label={t("manage.analytics.chart.title")}>
                <div className="event-analytics__block-head"><h2>{t("manage.analytics.chart.title")}</h2><p>{t("manage.analytics.chart.subtitle")}</p></div>
                <AnalyticsChart event={event} state={chartState} option={chartState === "ready" ? activityChartOption(data) : undefined}
                    ariaLabel={t("manage.analytics.chart.title")} loadingLabel={t("manage.analytics.chart.loading")} errorMessage={t("manage.analytics.chart.loadFailed")}
                    emptyMessage={t("manage.analytics.chart.empty")} onRetry={() => void overview.refetch()} />
            </section>
            <Feed overview={data} state={blockState} onRetry={() => void overview.refetch()} />
        </div>
    </AnalyticsPage>;
}
