"use client";

import {useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {getAnalyticsStands, type AnalyticsStands as Stands, type StandStatus, type StandTeam} from "@/api/manageAnalyticsStands";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {ManageTable, ManageTableSearch, type ManageTableState} from "@/components/event/manage/ManageTable";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import type {ChartState} from "./analyticsModel";
import {formatBytes, formatCount, formatCpu, formatDateTime, formatDuration, noValue} from "./analyticsFormat";
import {AnalyticsChart} from "./AnalyticsChart";
import {AnalyticsExportButton} from "./AnalyticsExportButton";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
import {standsChartOption} from "./standsChart";
import {useAnalyticsPeriod} from "./useAnalyticsPeriod";
import "./analyticsStands.css";

// Polls a little slower than the server's 10 s report cache.
export const STANDS_POLL_SECONDS = 15;

const statusTone: Record<StandStatus, string> = {ready: "ib-tag--ok", failed: "ib-tag--danger", creating: "ib-tag--warn", not_deployed: "", removed: ""};
const statuses: StandStatus[] = ["ready", "creating", "failed", "not_deployed", "removed"];
const allStatuses = "all";

function failureLine(failure: StandTeam["Failures"][number]): string {
    const what = failure.Source === "lab" ? t("manage.analytics.stands.failure.lab", {task: failure.Task}) : t("manage.analytics.stands.failure.stand");
    const outcome = failure.RecoverySeconds === null ? t("manage.analytics.stands.failure.open") : t("manage.analytics.stands.failure.recovered", {time: formatDuration(failure.RecoverySeconds)});
    return `${formatDateTime(failure.At)} · ${what}${failure.Reason ? `: ${failure.Reason}` : ""} · ${outcome}`;
}

function FailuresCell({team}: {team: StandTeam}) {
    if (team.FailureCount === 0) return <span className="event-manage-table__dim">{noValue}</span>;
    const lines = team.Failures.slice(0, 5).map(failureLine).join("\n");
    return <EventTooltip content={lines}>{id => <span className="event-stands__failures" tabIndex={0} aria-describedby={id}>
        <span className="event-manage-table__count">{formatCount(team.FailureCount)}</span>
        {team.Unresolved > 0 && <span className="ib-tag ib-tag--sm ib-tag--danger">{t("manage.analytics.stands.unresolved", {count: team.Unresolved})}</span>}
    </span>}</EventTooltip>;
}

function Summary({stands}: {stands: Stands}) {
    const s = stands.Summary;
    const median = s.DeployMedianSeconds;
    return <AnalyticsStatGrid label={t("manage.analytics.stands.stats.label")}>
        <AnalyticsStat label={t("manage.analytics.stands.stat.ready")} value={`${formatCount(s.Ready)} / ${formatCount(s.Teams)}`} note={t("manage.analytics.stands.stat.readyNote", {creating: s.Creating, notDeployed: s.NotDeployed})} hint={t("manage.analytics.stands.stat.readyHint")} />
        <AnalyticsStat label={t("manage.analytics.stands.stat.failed")} value={formatCount(s.Failed)} hint={t("manage.analytics.stands.stat.failedHint")} />
        <AnalyticsStat label={t("manage.analytics.stands.stat.deploy")} value={formatDuration(median)} note={median === null ? undefined : t("manage.analytics.stands.stat.deployNote", {avg: formatDuration(s.DeployAvgSeconds), max: formatDuration(s.DeployMaxSeconds)})} hint={t("manage.analytics.stands.stat.deployHint")} />
        <AnalyticsStat label={t("manage.analytics.stands.stat.failures")} value={formatCount(s.Failures)} note={t("manage.analytics.stands.stat.failuresNote", {count: s.Unresolved})} hint={t("manage.analytics.stands.stat.failuresHint")} />
        <AnalyticsStat label={t("manage.analytics.stands.stat.recovery")} value={formatDuration(s.RecoveryAvgSeconds)} note={s.RecoveryMaxSeconds === null ? undefined : t("manage.analytics.stands.stat.recoveryNote", {max: formatDuration(s.RecoveryMaxSeconds)})} hint={t("manage.analytics.stands.stat.recoveryHint")} />
        <AnalyticsStat label={t("manage.analytics.stands.stat.restarts")} value={formatCount(s.Restarts)} hint={t("manage.analytics.stands.stat.restartsHint")} />
        <AnalyticsStat label={t("manage.analytics.stands.stat.vpn")} value={formatCount(s.VPNTeams)} note={t("manage.analytics.stands.stat.vpnNote", {sessions: s.VPNSessions, traffic: formatBytes(s.VPNRxBytes + s.VPNTxBytes)})} hint={t("manage.analytics.stands.stat.vpnHint")} />
    </AnalyticsStatGrid>;
}

function TeamRows({teams}: {teams: StandTeam[]}) {
    return <tbody>{teams.map(team => <tr key={team.TeamID}>
        <td><div className="event-manage-table__person"><strong>{team.TeamName}</strong>{team.Reason && team.Status === "failed" && <small>{team.Reason}</small>}</div></td>
        <td><span className={`ib-tag ib-tag--sm ${statusTone[team.Status]}`.trim()}>{t(`manage.analytics.stands.status.${team.Status}`)}</span></td>
        <td className="event-manage-table__nowrap">{formatDuration(team.DeploySeconds)}{team.Generations > 1 && <small className="event-manage-table__dim"> {t("manage.analytics.stands.redeploys", {count: team.Generations - 1})}</small>}</td>
        <td><FailuresCell team={team} /></td>
        <td className="event-manage-table__nowrap">{team.RecoveryAvgSeconds === null ? noValue : t("manage.analytics.stands.recoveryCell", {avg: formatDuration(team.RecoveryAvgSeconds), max: formatDuration(team.RecoveryMaxSeconds)})}</td>
        <td className="event-manage-table__nowrap">{team.Resources.Devices === 0 ? noValue : formatCpu(team.Resources.PeakCPUMillicores)}</td>
        <td className="event-manage-table__nowrap">{team.Resources.Devices === 0 ? noValue : formatBytes(team.Resources.PeakMemoryBytes)}</td>
        <td>{team.Resources.Devices === 0 ? noValue : formatCount(team.Resources.Restarts)}</td>
        <td className="event-manage-table__nowrap">{team.VPN.Sessions === 0 ? t("manage.analytics.stands.vpn.none") : <div className="event-manage-table__person">
            <strong>{t("manage.analytics.stands.vpn.users", {users: team.VPN.Users, members: team.VPN.Members})}</strong>
            <small>{t("manage.analytics.stands.vpn.traffic", {time: formatDuration(team.VPN.Seconds), traffic: formatBytes(team.VPN.RxBytes + team.VPN.TxBytes)})}</small>
        </div>}</td>
    </tr>)}</tbody>;
}

// «Стенди» (§6.5): the state of every team's stand, deploy time, failures and
// how fast they were resolved, lab resource peaks and VPN usage. Only for an
// event with infrastructure.
export function AnalyticsStands() {
    const {event} = useManager();
    const eventID = event.EventID;
    const filter = useAnalyticsPeriod();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string>(allStatuses);
    const query = useQuery({
        queryKey: ["event-analytics-stands", eventID, filter.period.from, filter.period.to],
        queryFn: () => getAnalyticsStands(eventID, filter.period),
        refetchInterval: STANDS_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });
    const data = query.data;
    const title = t("manage.analytics.section.stands.title");
    const description = t("manage.analytics.section.stands.description");
    const actions = <>
        <LiveStatus freshness={{kind: "polling", seconds: STANDS_POLL_SECONDS, failing: query.isError}} updatedAt={query.dataUpdatedAt} />
        <AnalyticsExportButton eventID={eventID} section="stands" period={filter.period} disabled={!data?.Available} />
    </>;

    if (query.isPending) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoading event={event} label={t("manage.analytics.stands.loading")} /></div>
    </AnalyticsPage>;
    if (!data) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.stands.loadFailed")} error={query.error} onRetry={() => void query.refetch()} /></div>
    </AnalyticsPage>;
    if (!data.Available) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EmptyState message={t("manage.analytics.stands.unavailable")} /></div>
    </AnalyticsPage>;

    const needle = search.trim().toLowerCase();
    const teams = data.Teams.filter(team => (status === allStatuses || team.Status === status) && (!needle || team.TeamName.toLowerCase().includes(needle)));
    const chartState: ChartState = data.Teams.some(team => team.DeploySeconds !== null) ? "ready" : "empty";
    const tableState: ManageTableState = data.Teams.length === 0 || teams.length === 0 ? "empty" : "ready";

    return <AnalyticsPage title={title} description={description} actions={actions} filter={<AnalyticsPeriodFilter period={filter} />}>
        <Summary stands={data} />
        <section className="event-analytics__block" aria-label={t("manage.analytics.stands.chart.title")}>
            <div className="event-analytics__block-head"><h2>{t("manage.analytics.stands.chart.title")}</h2><p>{t("manage.analytics.stands.chart.subtitle")}</p></div>
            <AnalyticsChart event={event} state={chartState} option={chartState === "ready" ? standsChartOption(data) : undefined}
                ariaLabel={t("manage.analytics.stands.chart.title")} loadingLabel={t("manage.analytics.stands.loading")} errorMessage={t("manage.analytics.stands.loadFailed")}
                emptyMessage={t("manage.analytics.stands.chart.empty")} onRetry={() => void query.refetch()} />
        </section>
        <ManageTable event={event} state={tableState} loadingLabel={t("manage.analytics.stands.loading")} errorMessage={t("manage.analytics.stands.loadFailed")}
            emptyMessage={t("manage.analytics.stands.table.empty")} onRetry={() => void query.refetch()} busy={query.isFetching}
            toolbar={<>
                <ManageTableSearch value={search} onChange={setSearch} label={t("manage.analytics.stands.table.search")} />
                <EventSelect ariaLabel={t("manage.analytics.stands.table.status")} value={status} onValueChange={setStatus}
                    options={[{value: allStatuses, label: t("manage.analytics.stands.table.allStatuses")}, ...statuses.map(value => ({value, label: t(`manage.analytics.stands.status.${value}`)}))]} />
            </>}
            head={<tr>
                <th scope="col">{t("manage.analytics.stands.col.team")}</th>
                <th scope="col">{t("manage.analytics.stands.col.status")}</th>
                <th scope="col">{t("manage.analytics.stands.col.deploy")}</th>
                <th scope="col">{t("manage.analytics.stands.col.failures")}</th>
                <th scope="col">{t("manage.analytics.stands.col.recovery")}</th>
                <th scope="col">{t("manage.analytics.stands.col.cpu")}</th>
                <th scope="col">{t("manage.analytics.stands.col.memory")}</th>
                <th scope="col">{t("manage.analytics.stands.col.restarts")}</th>
                <th scope="col">{t("manage.analytics.stands.col.vpn")}</th>
            </tr>}>
            <TeamRows teams={teams} />
        </ManageTable>
    </AnalyticsPage>;
}
