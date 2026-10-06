"use client";

import {useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {getAnalyticsParticipants, type AnalyticsDropOff, type AnalyticsParticipants as Participants, type AnalyticsQuestion} from "@/api/manageAnalyticsPeople";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";
import {MANAGE_PAGE_SIZES, ManageTable, ManageTablePagination, ManageTableSearch} from "@/components/event/manage/ManageTable";
import {EmptyState} from "@/components/ui/EmptyState";
import {zoneLabel} from "@/components/ui/dateTimePicker";
import {t} from "@/i18n/t";
import type {ChartState} from "./analyticsModel";
import {AnalyticsBlock, AnalyticsTableExport} from "./AnalyticsBlock";
import {AnalyticsChart} from "./AnalyticsChart";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
import {useAnalyticsPeriod} from "./useAnalyticsPeriod";
import {
    bucketLabel, fillChartOption, fillHasData, funnelChartOption, funnelHasData, questionChartOption, questionHasData,
    questionShape, registrationsChartOption, registrationsHaveData,
} from "./peopleModel";

// Polls a little slower than the server's 10 s report cache; registrations
// keep coming before and during the event.
export const PARTICIPANTS_POLL_SECONDS = 30;

const number = new Intl.NumberFormat("uk-UA");
const dateTime = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"});

// Rows of the drop-off list matching the search (name, email or team).
export function filterDropOff(rows: AnalyticsDropOff[], search: string): AnalyticsDropOff[] {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(row => [row.Name, row.Email, row.TeamName].some(value => value.toLowerCase().includes(needle)));
}

function chartState(pending: boolean, data: unknown, hasData: boolean): ChartState {
    return pending ? "loading" : !data ? "error" : hasData ? "ready" : "empty";
}

function QuestionCard({question, event, respondents}: {question: AnalyticsQuestion; event: ReturnType<typeof useManager>["event"]; respondents: number}) {
    const list = questionShape(question) === "list";
    const meta = t("manage.analytics.people.answers.answered", {answered: question.Answered, asked: question.Asked || respondents});
    const numeric = question.Min !== null && question.Max !== null && question.Avg !== null;
    return <article className="event-analytics-question">
        <div className="event-analytics-question__head">
            <h3>{question.Label}</h3>
            <small>{meta}{numeric && ` · ${t("manage.analytics.people.answers.range", {min: number.format(question.Min ?? 0), max: number.format(question.Max ?? 0), avg: number.format(Math.round((question.Avg ?? 0) * 100) / 100)})}`}</small>
        </div>
        {list
            ? <ul className="event-analytics-values" aria-label={question.Label}>
                {question.Buckets.length === 0 && <EmptyState message={question.Distinct > 0 ? t("manage.analytics.people.answers.noRepeats", {count: question.Distinct}) : t("manage.analytics.people.answers.noAnswers")} />}
                {question.Buckets.map(bucket => <li key={bucket.Label}><span>{bucketLabel(question, bucket)}</span><strong>{number.format(bucket.Count)}</strong></li>)}
            </ul>
            : <AnalyticsChart event={event} state={questionHasData(question) ? "ready" : "empty"} option={questionHasData(question) ? questionChartOption(question) : undefined} height={220}
                ariaLabel={question.Label} loadingLabel={t("manage.analytics.chart.loading")} errorMessage={t("manage.analytics.chart.loadFailed")} emptyMessage={t("manage.analytics.people.answers.noAnswers")} />}
    </article>;
}

function DropOffTable({data, state, onRetry, error, period, eventID}: {error?: unknown; data?: Participants["DropOff"]; state: "loading" | "error" | "ready"; onRetry: () => void; period: ReturnType<typeof useAnalyticsPeriod>["period"]; eventID: string}) {
    const {event} = useManager();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(MANAGE_PAGE_SIZES[0]);
    const matching = filterDropOff(data?.Rows ?? [], search);
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    const current = Math.min(page, pages);
    const rows = matching.slice((current - 1) * pageSize, current * pageSize);
    const tableState = state !== "ready" ? state : rows.length === 0 ? "empty" : "ready";
    const {offset} = zoneLabel();
    const cut = data && data.Total > data.Rows.length;
    return <AnalyticsBlock title={t("manage.analytics.people.dropoff.title")} subtitle={t("manage.analytics.people.dropoff.subtitle")} hint={t("manage.analytics.people.dropoff.hint")}
        actions={<AnalyticsTableExport eventID={eventID} section="participants" table="dropoff" period={period} disabled={!data || data.Total === 0} />}>
        <div className="event-analytics-people__table">
            <ManageTable event={event} state={tableState} loadingLabel={t("manage.analytics.people.dropoff.loading")} errorMessage={t("manage.analytics.people.dropoff.loadFailed")} onRetry={onRetry} error={error}
                emptyMessage={search ? t("manage.analytics.people.dropoff.emptyFiltered") : t("manage.analytics.people.dropoff.empty")}
                toolbar={<>
                    <ManageTableSearch value={search} label={t("manage.analytics.people.dropoff.search")} onChange={value => {setSearch(value); setPage(1);}} />
                    {cut && <span className="event-analytics-people__note">{t("manage.analytics.people.dropoff.cut", {shown: data.Rows.length, total: data.Total})}</span>}
                </>}
                head={<tr>
                    <th scope="col">{t("manage.analytics.people.dropoff.col.participant")}</th>
                    <th scope="col">{t("manage.analytics.people.dropoff.col.team")}</th>
                    <th scope="col">{t("manage.analytics.people.dropoff.col.registered", {offset})}</th>
                    <th scope="col">{t("manage.analytics.people.dropoff.col.approved", {offset})}</th>
                    <th scope="col" className="ib-num">{t("manage.analytics.people.dropoff.col.opened")}</th>
                </tr>}
                footer={<ManageTablePagination event={event} page={current} pageSize={pageSize} total={matching.length} hasNext={current < pages} onPrevious={() => setPage(current - 1)} onNext={() => setPage(current + 1)} onPageSize={size => {setPageSize(size); setPage(1);}} />}>
                <tbody>{rows.map(row => <tr key={row.UserID}>
                    <td><div className="event-manage-table__person"><strong>{row.Name || row.Email}</strong>{row.Name && <small>{row.Email}</small>}</div></td>
                    <td>{row.TeamName || <span className="event-manage-table__dim">{t("manage.analytics.people.dropoff.noTeam")}</span>}</td>
                    <td className="event-manage-table__nowrap"><time dateTime={row.RegisteredAt}>{dateTime.format(new Date(row.RegisteredAt))}</time></td>
                    <td className="event-manage-table__nowrap">{row.ApprovedAt ? <time dateTime={row.ApprovedAt}>{dateTime.format(new Date(row.ApprovedAt))}</time> : <span className="event-manage-table__dim">—</span>}</td>
                    <td className="ib-num">{number.format(row.OpenedTasks)}</td>
                </tr>)}</tbody>
            </ManageTable>
        </div>
    </AnalyticsBlock>;
}

function IncompleteTeamsTable({data, state, onRetry, error}: {error?: unknown; data?: Participants["Teams"]; state: "loading" | "error" | "ready"; onRetry: () => void}) {
    const {event} = useManager();
    const rows = data?.Incomplete ?? [];
    const tableState = state !== "ready" ? state : rows.length === 0 ? "empty" : "ready";
    return <div className="event-analytics-people__table event-analytics-people__table--short">
        <ManageTable event={event} state={tableState} loadingLabel={t("manage.analytics.people.fill.loading")} errorMessage={t("manage.analytics.people.fill.loadFailed")} onRetry={onRetry} error={error}
            emptyMessage={t("manage.analytics.people.fill.noIncomplete")}
            head={<tr>
                <th scope="col">{t("manage.analytics.people.fill.col.team")}</th>
                <th scope="col" className="ib-num">{t("manage.analytics.people.fill.col.members")}</th>
                <th scope="col" className="ib-num">{t("manage.analytics.people.fill.col.pending")}</th>
            </tr>}>
            <tbody>{rows.map(row => <tr key={row.ID}>
                <td>{row.Name}</td>
                <td className="ib-num">{t("manage.analytics.people.fill.members", {count: row.Members, min: data?.MinSize ?? 0})}</td>
                <td className="ib-num">{number.format(row.PendingInvitees)}</td>
            </tr>)}</tbody>
        </ManageTable>
    </div>;
}

// «Учасники й реєстрація» (§6.2): the participation funnel, registrations per
// day and channel, team fill, the registration form answers and the list of
// approved participants who never attempted a task.
export function AnalyticsParticipants() {
    const {event} = useManager();
    const eventID = event.EventID;
    const filter = useAnalyticsPeriod();
    const query = useQuery({
        queryKey: ["event-analytics-participants", eventID, filter.period.from, filter.period.to],
        queryFn: () => getAnalyticsParticipants(eventID, filter.period),
        refetchInterval: PARTICIPANTS_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });
    const data = query.data;
    const retry = () => void query.refetch();
    const blockState = query.isPending ? "loading" : !data ? "error" : "ready";
    const teamMode = data?.TeamMode ?? event.Participation === 1;
    const chartLabels = {loadingLabel: t("manage.analytics.chart.loading"), errorMessage: t("manage.analytics.chart.loadFailed"), onRetry: retry, error: query.error};

    const registered = data?.Funnel.find(stage => stage.Stage === "registered")?.Count ?? 0;
    const approved = data?.Funnel.find(stage => stage.Stage === "approved")?.Count ?? 0;

    return <AnalyticsPage title={t("manage.analytics.section.participants.title")} description={t("manage.analytics.section.participants.description")}
        filter={<AnalyticsPeriodFilter period={filter} open />}>
        {data && <AnalyticsStatGrid label={t("manage.analytics.stats.label")}>
            <AnalyticsStat label={t("manage.analytics.stat.registered")} value={number.format(registered)} hint={t("manage.analytics.stat.registeredHint")} />
            <AnalyticsStat label={t("manage.analytics.stat.approved")} value={number.format(approved)} hint={t("manage.analytics.stat.approvedHint")} />
            {teamMode && <AnalyticsStat label={t("manage.analytics.people.stat.teams")} value={number.format(data.Teams.Total)} note={t("manage.analytics.people.stat.teamsNote", {incomplete: data.Teams.Incomplete.length})} hint={t("manage.analytics.stat.teamsHint")} />}
            <AnalyticsStat label={t("manage.analytics.people.stat.dropoff")} value={number.format(data.DropOff.Total)} hint={t("manage.analytics.people.dropoff.hint")} />
        </AnalyticsStatGrid>}

        <div className="event-analytics__columns">
            <AnalyticsBlock title={t("manage.analytics.people.funnel.title")} subtitle={t("manage.analytics.people.funnel.subtitle")} hint={t("manage.analytics.people.funnel.hint")}
                actions={<AnalyticsTableExport eventID={eventID} section="participants" table="funnel" period={filter.period} disabled={!data} />}>
                <AnalyticsChart event={event} state={chartState(query.isPending, data, !!data && funnelHasData(data.Funnel))} option={data && funnelHasData(data.Funnel) ? funnelChartOption(data.Funnel) : undefined}
                    height={340} ariaLabel={t("manage.analytics.people.funnel.title")} emptyMessage={t("manage.analytics.people.funnel.empty")} {...chartLabels} />
            </AnalyticsBlock>
            <AnalyticsBlock title={t("manage.analytics.people.registrations.title")} subtitle={t("manage.analytics.people.registrations.subtitle")} hint={t("manage.analytics.people.registrations.hint")}
                actions={<AnalyticsTableExport eventID={eventID} section="participants" table="registrations" period={filter.period} disabled={!data} />}>
                <AnalyticsChart event={event} state={chartState(query.isPending, data, !!data && registrationsHaveData(data.Registrations))} option={data && registrationsHaveData(data.Registrations) ? registrationsChartOption(data.Registrations) : undefined}
                    height={340} ariaLabel={t("manage.analytics.people.registrations.title")} emptyMessage={t("manage.analytics.people.registrations.empty")} {...chartLabels} />
            </AnalyticsBlock>
        </div>

        {teamMode && <AnalyticsBlock title={t("manage.analytics.people.fill.title")} subtitle={data ? t("manage.analytics.people.fill.subtitle", {min: data.Teams.MinSize, max: data.Teams.MaxSize}) : undefined} hint={t("manage.analytics.people.fill.hint")}
            actions={<AnalyticsTableExport eventID={eventID} section="participants" table="teams" period={filter.period} disabled={!data || data.Teams.Incomplete.length === 0} />}>
            <div className="event-analytics-fill">
                <AnalyticsChart event={event} state={chartState(query.isPending, data, !!data && fillHasData(data.Teams))} option={data && fillHasData(data.Teams) ? fillChartOption(data.Teams) : undefined}
                    height={320} ariaLabel={t("manage.analytics.people.fill.title")} emptyMessage={t("manage.analytics.people.fill.empty")} {...chartLabels} />
                <IncompleteTeamsTable data={data?.Teams} state={blockState} onRetry={retry} error={query.error} />
            </div>
            {data && <p className="event-analytics-people__note event-analytics-people__body">{t("manage.analytics.people.fill.summary", {pending: data.Teams.PendingInvitees, withoutTeam: data.Teams.WithoutTeam})}</p>}
        </AnalyticsBlock>}

        <AnalyticsBlock title={t("manage.analytics.people.answers.title")} subtitle={data ? t("manage.analytics.people.answers.subtitle", {count: data.Answers.Respondents}) : undefined} hint={t("manage.analytics.people.answers.hint")}
            actions={<AnalyticsTableExport eventID={eventID} section="participants" table="answers" period={filter.period} disabled={!data || data.Answers.Questions.length === 0} />}>
            {query.isPending && <div className="event-analytics-people__body" style={{minHeight: 240}}><EventLoading event={event} label={t("manage.analytics.people.answers.loading")} /></div>}
            {!query.isPending && !data && <div className="event-analytics-people__body" style={{minHeight: 240}}><EventLoadError message={t("manage.analytics.people.answers.loadFailed")} error={query.error} onRetry={retry} /></div>}
            {data && data.Answers.Questions.length === 0 && <div className="event-analytics-people__body" style={{minHeight: 240}}><EmptyState message={t("manage.analytics.people.answers.empty")} /></div>}
            {data && data.Answers.Questions.length > 0 && <div className="event-analytics-questions">
                {data.Answers.Questions.map(question => <QuestionCard key={question.Key} question={question} event={event} respondents={data.Answers.Respondents} />)}
            </div>}
        </AnalyticsBlock>

        <DropOffTable data={data?.DropOff} state={blockState} onRetry={retry} error={query.error} period={filter.period} eventID={eventID} />
    </AnalyticsPage>;
}
