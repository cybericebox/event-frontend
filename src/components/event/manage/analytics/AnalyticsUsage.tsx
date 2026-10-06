"use client";

import {Fragment, useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {ChevronDown, ChevronRight} from "lucide-react";
import {getAnalyticsUsage, type AnalyticsUsage as Usage, type UsageUser} from "@/api/manageAnalyticsUsage";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {ManageTable, ManageTableSearch, type ManageTableState} from "@/components/event/manage/ManageTable";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {formatBytes, formatCount, formatDateTime, formatDuration, noValue} from "./analyticsFormat";
import {LastActivity} from "../LastActivity";
import {AnalyticsExportButton} from "./AnalyticsExportButton";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
import {useAnalyticsPeriod} from "./useAnalyticsPeriod";
import "./analyticsUsage.css";

// «Online now» is live, so the report is polled often; the server does not cache it.
export const USAGE_POLL_SECONDS = 10;

const allTeams = "all";

type UsageState = "online" | "offline" | "never";

// The connection state comes from the last handshake alone (the server decides
// «online»), never from traffic.
export const usageState = (user: UsageUser): UsageState => user.VPN.Online ? "online" : user.VPN.LastHandshakeAt ? "offline" : "never";

const stateTone: Record<UsageState, string> = {online: "ib-tag--ok", offline: "", never: ""};

const userName = (user: UsageUser) => user.UserName || t("manage.analytics.usage.unnamed");

function Summary({usage}: {usage: Usage}) {
    const s = usage.Summary;
    return <AnalyticsStatGrid label={t("manage.analytics.usage.stats.label")}>
        <AnalyticsStat label={t("manage.analytics.usage.stat.online")} value={formatCount(s.OnlineNow)} note={t("manage.analytics.usage.stat.onlineNote", {users: s.Users})} hint={t("manage.analytics.usage.stat.onlineHint")} />
        <AnalyticsStat label={t("manage.analytics.usage.stat.connected")} value={formatCount(s.VPNUsers)} note={t("manage.analytics.usage.stat.connectedNote", {sessions: s.Sessions})} hint={t("manage.analytics.usage.stat.connectedHint")} />
        <AnalyticsStat label={t("manage.analytics.usage.stat.time")} value={formatDuration(s.OnlineSeconds)} hint={t("manage.analytics.usage.stat.timeHint")} />
        <AnalyticsStat label={t("manage.analytics.usage.stat.traffic")} value={formatBytes(s.RxBytes + s.TxBytes)} note={t("manage.analytics.usage.stat.trafficNote", {rx: formatBytes(s.RxBytes), tx: formatBytes(s.TxBytes)})} hint={t("manage.analytics.usage.stat.trafficHint")} />
        <AnalyticsStat label={t("manage.analytics.usage.stat.proxy")} value={formatCount(s.ProxyUsers)} note={t("manage.analytics.usage.stat.proxyNote", {requests: formatCount(s.ProxyRequests), traffic: formatBytes(s.ProxyBytes)})} hint={t("manage.analytics.usage.stat.proxyHint")} />
    </AnalyticsStatGrid>;
}

function Detail({user}: {user: UsageUser}) {
    return <div className="event-usage__detail">
        <section aria-label={t("manage.analytics.usage.detail.sessions")}>
            <h3>{t("manage.analytics.usage.detail.sessions")}</h3>
            {user.VPN.Recent.length === 0 ? <p className="event-manage-table__dim">{t("manage.analytics.usage.detail.noSessions")}</p> : <ul>
                {user.VPN.Recent.map(session => <li key={session.StartedAt}>
                    {t("manage.analytics.usage.detail.session", {from: formatDateTime(session.StartedAt), to: formatDateTime(session.EndedAt), time: formatDuration(session.Seconds)})}
                </li>)}
            </ul>}
            {user.VPN.Sessions > user.VPN.Recent.length && <p className="event-manage-table__dim">{t("manage.analytics.usage.detail.moreSessions", {count: user.VPN.Sessions - user.VPN.Recent.length})}</p>}
        </section>
        <section aria-label={t("manage.analytics.usage.detail.labs")}>
            <h3>{t("manage.analytics.usage.detail.labs")}</h3>
            {user.Labs.length === 0 ? <p className="event-manage-table__dim">{t("manage.analytics.usage.detail.noLabs")}</p> : <table className="event-usage__labs">
                <thead><tr>
                    <th scope="col">{t("manage.analytics.usage.detail.task")}</th>
                    <th scope="col">{t("manage.analytics.usage.detail.access")}</th>
                    <th scope="col">{t("manage.analytics.usage.detail.requests")}</th>
                    <th scope="col">{t("manage.analytics.usage.detail.traffic")}</th>
                    <th scope="col">{t("manage.analytics.usage.detail.last")}</th>
                </tr></thead>
                <tbody>{user.Labs.map(lab => <tr key={`${lab.ChallengeID}:${lab.Surface}`}>
                    <td>{lab.Task || noValue}</td>
                    <td>{t(`manage.analytics.usage.surface.${lab.Surface}`)}</td>
                    <td>{formatCount(lab.Attempts)}</td>
                    <td className="event-manage-table__nowrap">{formatBytes(lab.BytesIn + lab.BytesOut)}</td>
                    <td className="event-manage-table__nowrap">{formatDateTime(lab.LastAt)}</td>
                </tr>)}</tbody>
            </table>}
        </section>
    </div>;
}

function UserRows({users}: {users: UsageUser[]}) {
    const [open, setOpen] = useState<string | null>(null);
    return <tbody>{users.map(user => {
        const state = usageState(user);
        const expanded = open === user.UserID;
        const Chevron = expanded ? ChevronDown : ChevronRight;
        return <Fragment key={user.UserID}>
            <tr>
                <td><div className="event-usage__person">
                    <button className="event-usage__toggle" type="button" aria-expanded={expanded} aria-label={t("manage.analytics.usage.toggle", {name: userName(user)})}
                        onClick={() => setOpen(expanded ? null : user.UserID)}><Chevron size={16} aria-hidden="true" /></button>
                    <div className="event-manage-table__person"><strong>{userName(user)}</strong><small>{user.TeamName}</small></div>
                </div></td>
                <td><span className={`ib-tag ib-tag--sm ${stateTone[state]}`.trim()}>{t(`manage.analytics.usage.state.${state}`)}</span></td>
                <td className="event-manage-table__nowrap"><LastActivity at={user.LastSeenAt} /></td>
                <td className="event-manage-table__nowrap"><LastActivity at={user.LastLabAt} /></td>
                <td className="event-manage-table__nowrap">{formatDateTime(user.VPN.LastHandshakeAt)}</td>
                <td>{user.VPN.Sessions === 0 ? noValue : formatCount(user.VPN.Sessions)}</td>
                <td className="event-manage-table__nowrap">{user.VPN.Sessions === 0 ? noValue : formatDuration(user.VPN.Seconds)}</td>
                <td className="event-manage-table__nowrap">{user.VPN.Sessions === 0 ? noValue : formatBytes(user.VPN.RxBytes + user.VPN.TxBytes)}</td>
                <td>{user.Proxy.Requests === 0 ? noValue : formatCount(user.Proxy.Requests)}</td>
                <td className="event-manage-table__nowrap">{user.Proxy.Requests === 0 ? noValue : formatBytes(user.Proxy.BytesIn + user.Proxy.BytesOut)}</td>
                <td className="event-manage-table__nowrap">{formatDateTime(user.Proxy.LastAt)}</td>
            </tr>
            {expanded && <tr className="event-usage__detail-row"><td colSpan={11}><Detail user={user} /></td></tr>}
        </Fragment>;
    })}</tbody>;
}

// «Використання»: per participant, whether the VPN is connected now (from the
// last handshake), how many sessions and how long online, the VPN traffic, and
// the web proxy use. Counts and times only. Only for an event with infrastructure.
export function AnalyticsUsage() {
    const {event} = useManager();
    const eventID = event.EventID;
    const filter = useAnalyticsPeriod();
    const [search, setSearch] = useState("");
    const [team, setTeam] = useState<string>(allTeams);
    const query = useQuery({
        queryKey: ["event-analytics-usage", eventID, filter.period.from, filter.period.to],
        queryFn: () => getAnalyticsUsage(eventID, filter.period),
        refetchInterval: USAGE_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });
    const data = query.data;
    const title = t("manage.analytics.section.usage.title");
    const description = t("manage.analytics.section.usage.description");
    const actions = <>
        <LiveStatus freshness={{kind: "polling", seconds: USAGE_POLL_SECONDS, failing: query.isError}} updatedAt={query.dataUpdatedAt} />
        <AnalyticsExportButton eventID={eventID} section="usage" period={filter.period} disabled={!data?.Available} />
    </>;

    if (query.isPending) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoading event={event} label={t("manage.analytics.usage.loading")} /></div>
    </AnalyticsPage>;
    if (!data) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.usage.loadFailed")} error={query.error} onRetry={() => void query.refetch()} /></div>
    </AnalyticsPage>;
    if (!data.Available) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EmptyState message={t("manage.analytics.usage.unavailable")} /></div>
    </AnalyticsPage>;

    const teams = [...new Map(data.Users.map(user => [user.TeamID, user.TeamName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const needle = search.trim().toLowerCase();
    const users = data.Users.filter(user => (team === allTeams || user.TeamID === team)
        && (!needle || user.UserName.toLowerCase().includes(needle) || user.TeamName.toLowerCase().includes(needle)));
    const tableState: ManageTableState = users.length === 0 ? "empty" : "ready";

    return <AnalyticsPage title={title} description={description} actions={actions} filter={<AnalyticsPeriodFilter period={filter} />}>
        <Summary usage={data} />
        <ManageTable event={event} state={tableState} loadingLabel={t("manage.analytics.usage.loading")} errorMessage={t("manage.analytics.usage.loadFailed")}
            emptyMessage={t("manage.analytics.usage.table.empty")} onRetry={() => void query.refetch()} busy={query.isFetching}
            toolbar={<>
                <ManageTableSearch value={search} onChange={setSearch} label={t("manage.analytics.usage.table.search")} />
                <EventSelect ariaLabel={t("manage.analytics.usage.table.team")} value={team} onValueChange={setTeam}
                    options={[{value: allTeams, label: t("manage.analytics.usage.table.allTeams")}, ...teams.map(([value, label]) => ({value, label}))]} />
            </>}
            head={<tr>
                <th scope="col">{t("manage.analytics.usage.col.participant")}</th>
                <th scope="col">{t("manage.analytics.usage.col.state")}</th>
                <th scope="col">{t("manage.analytics.usage.col.seen")}</th>
                <th scope="col">{t("manage.analytics.usage.col.lab")}</th>
                <th scope="col">{t("manage.analytics.usage.col.last")}</th>
                <th scope="col">{t("manage.analytics.usage.col.sessions")}</th>
                <th scope="col">{t("manage.analytics.usage.col.time")}</th>
                <th scope="col">{t("manage.analytics.usage.col.traffic")}</th>
                <th scope="col">{t("manage.analytics.usage.col.proxyRequests")}</th>
                <th scope="col">{t("manage.analytics.usage.col.proxyTraffic")}</th>
                <th scope="col">{t("manage.analytics.usage.col.proxyLast")}</th>
            </tr>}>
            <UserRows users={users} />
        </ManageTable>
    </AnalyticsPage>;
}
