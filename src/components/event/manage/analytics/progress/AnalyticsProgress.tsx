"use client";

import {useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {X} from "lucide-react";
import {analyticsExportPath} from "@/api/manageAnalytics";
import {getAnalyticsHeatmap, getAnalyticsInactive, getAnalyticsMatrix, getAnalyticsScores, inactiveExportPath} from "@/api/manageAnalyticsTasks";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {useManager} from "@/components/event/manage/ManagerShell";
import {MANAGE_PAGE_SIZES, ManageTable, ManageTablePagination, ManageTableSearch, type ManageTableState} from "@/components/event/manage/ManageTable";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import type {ChartState} from "../analyticsModel";
import {AnalyticsChart} from "../AnalyticsChart";
import {AnalyticsPage} from "../AnalyticsPage";
import {AnalyticsPeriodFilter} from "../AnalyticsPeriodFilter";
import {useAnalyticsPeriod} from "../useAnalyticsPeriod";
import {HelpButton, SectionBlock} from "../tasks/SectionBlock";
import {formatDuration} from "../tasks/tasksModel";
import {CsvButton} from "./CsvButton";
import {
    DEFAULT_INACTIVE_MINUTES, DEFAULT_TOP, heatmapHasData, heatmapOption, INACTIVE_OPTIONS, inactiveMinutesLabel, matrixHasData, matrixIndex, MAX_CHOSEN_TEAMS,
    filterMatrixTeams, pickableTeams, scoreChartOption, scoresHaveData, TOP_OPTIONS,
} from "./progressModel";
import "../tasks/tasks.css";

// Polls a little slower than the server's 10 s report cache.
export const PROGRESS_POLL_SECONDS = 30;

const number = new Intl.NumberFormat("uk-UA");
const stamp = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});
const cellTime = new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit"});

const chartStateOf = (pending: boolean, failed: boolean, hasData: boolean): ChartState => pending ? "loading" : failed ? "error" : hasData ? "ready" : "empty";

// «Прогрес» (§6.4): the score over time of the leaders and chosen teams, the
// team × task matrix, the hourly activity heatmap and the idle teams.
export function AnalyticsProgress() {
    const {event} = useManager();
    const eventID = event.EventID;
    const filter = useAnalyticsPeriod();
    const [top, setTop] = useState<number>(DEFAULT_TOP);
    const [chosen, setChosen] = useState<string[]>([]);
    const [minutes, setMinutes] = useState<number>(DEFAULT_INACTIVE_MINUTES);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(MANAGE_PAGE_SIZES[0]);
    const poll = {refetchInterval: PROGRESS_POLL_SECONDS * 1000, refetchOnWindowFocus: false, placeholderData: keepPreviousData} as const;
    const {from, to} = filter.period;
    const scores = useQuery({queryKey: ["event-analytics-scores", eventID, from, to, top, chosen], queryFn: () => getAnalyticsScores(eventID, filter.period, top, chosen), ...poll});
    const matrix = useQuery({queryKey: ["event-analytics-matrix", eventID, from, to], queryFn: () => getAnalyticsMatrix(eventID, filter.period), ...poll});
    const heatmap = useQuery({queryKey: ["event-analytics-heatmap", eventID, from, to], queryFn: () => getAnalyticsHeatmap(eventID, filter.period), ...poll});
    const inactive = useQuery({queryKey: ["event-analytics-inactive", eventID, minutes], queryFn: () => getAnalyticsInactive(eventID, minutes), ...poll});
    const queries = [scores, matrix, heatmap, inactive];

    const status = <LiveStatus freshness={{kind: "polling", seconds: PROGRESS_POLL_SECONDS, failing: queries.some(query => query.isError)}} updatedAt={Math.max(...queries.map(query => query.dataUpdatedAt))} />;

    // Score chart -------------------------------------------------------
    const scoreData = scores.data;
    const teamName = (id: string) => scoreData?.Teams.find(team => team.TeamID === id)?.Name ?? id;
    const scoreControls = <>
        <EventSelect ariaLabel={t("manage.analytics.progress.scores.top")} value={String(top)} options={TOP_OPTIONS.map(count => ({value: String(count), label: t("manage.analytics.progress.scores.topN", {count})}))} onValueChange={value => setTop(Number(value))} />
        <EventSelect ariaLabel={t("manage.analytics.progress.scores.addTeam")} value="" placeholder={t("manage.analytics.progress.scores.addTeam")} disabled={chosen.length >= MAX_CHOSEN_TEAMS || !scoreData}
            options={pickableTeams(scoreData, chosen)} emptyLabel={t("manage.analytics.progress.scores.noTeams")} onValueChange={id => setChosen(current => current.includes(id) ? current : [...current, id])} />
    </>;

    // Matrix ------------------------------------------------------------
    const matrixData = matrix.data;
    const cell = matrixData ? matrixIndex(matrixData) : undefined;
    const teams = matrixData ? filterMatrixTeams(matrixData.Teams, search) : [];
    const pages = Math.max(1, Math.ceil(teams.length / pageSize));
    const current = Math.min(page, pages);
    const pageTeams = teams.slice((current - 1) * pageSize, current * pageSize);
    const matrixState: ManageTableState = matrix.isPending ? "loading" : !matrixData ? "error" : !matrixHasData(matrixData) || teams.length === 0 ? "empty" : "ready";

    // Inactive ----------------------------------------------------------
    const idle = inactive.data;
    const idleState: ManageTableState = inactive.isPending ? "loading" : !idle ? "error" : idle.Teams.length === 0 ? "empty" : "ready";
    const idleEmpty = idle && !idle.Running ? t("manage.analytics.progress.inactive.notStarted") : t("manage.analytics.progress.inactive.none", {threshold: inactiveMinutesLabel(minutes)});

    return <AnalyticsPage title={t("manage.analytics.section.progress.title")} description={t("manage.analytics.section.progress.description")} actions={status} filter={<AnalyticsPeriodFilter period={filter} />}>
        <SectionBlock title={t("manage.analytics.progress.scores.title")} subtitle={t("manage.analytics.progress.scores.subtitle")} hint={t("manage.analytics.progress.scores.hint")} actions={scoreControls}>
            {chosen.length > 0 && <ul className="event-analytics-tasks__chips" aria-label={t("manage.analytics.progress.scores.chosen")}>{chosen.map(id => <li className="event-analytics-tasks__chip" key={id}>
                <span>{teamName(id)}</span>
                <button type="button" aria-label={t("manage.analytics.progress.scores.remove", {team: teamName(id)})} onClick={() => setChosen(list => list.filter(item => item !== id))}><X size={12} aria-hidden="true" /></button>
            </li>)}</ul>}
            <AnalyticsChart event={event} state={chartStateOf(scores.isPending, !scoreData, !!scoreData && scoresHaveData(scoreData))} option={scoreData ? scoreChartOption(scoreData) : undefined} height={360}
                ariaLabel={t("manage.analytics.progress.scores.title")} loadingLabel={t("manage.analytics.progress.loading")} errorMessage={t("manage.analytics.progress.loadFailed")} emptyMessage={t("manage.analytics.progress.scores.empty")} onRetry={() => void scores.refetch()} error={scores.error} />
        </SectionBlock>

        <SectionBlock title={t("manage.analytics.progress.matrix.title")} subtitle={t("manage.analytics.progress.matrix.subtitle")} hint={t("manage.analytics.progress.matrix.hint")}
            actions={<CsvButton eventID={eventID} path={analyticsExportPath("progress/matrix", filter.period)} name="analytics-progress-matrix" disabled={!matrixData} />}>
            <div className="event-analytics-tasks__table event-analytics-tasks__table--tall">
                <ManageTable event={event} state={matrixState} busy={matrix.isPlaceholderData} loadingLabel={t("manage.analytics.progress.loading")} emptyMessage={search ? t("manage.analytics.progress.matrix.emptyFiltered") : t("manage.analytics.progress.matrix.empty")} errorMessage={t("manage.analytics.progress.loadFailed")} onRetry={() => void matrix.refetch()} error={matrix.error}
                    toolbar={<>
                        <ManageTableSearch value={search} onChange={value => {setSearch(value); setPage(1);}} label={t("manage.analytics.progress.matrix.search")} />
                        <div className="event-analytics-tasks__legend" aria-label={t("manage.analytics.progress.matrix.legend")}>
                            <span><i className="event-analytics-tasks__cell event-analytics-tasks__cell--solved">12:30</i>{t("manage.analytics.progress.matrix.solved")}</span>
                            <span><i className="event-analytics-tasks__cell event-analytics-tasks__cell--tried">3</i>{t("manage.analytics.progress.matrix.tried")}</span>
                            <span><i className="event-analytics-tasks__cell event-analytics-tasks__cell--untouched">—</i>{t("manage.analytics.progress.matrix.untouched")}</span>
                        </div>
                    </>}
                    head={<tr>
                        <th scope="col">{t("manage.analytics.progress.matrix.col.team")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.progress.matrix.col.points")}</th>
                        {(matrixData?.Tasks ?? []).map(task => <th scope="col" key={task.ChallengeID}><span className="event-analytics-tasks__task-head" title={task.Name}>{task.Name}</span></th>)}
                    </tr>}
                    footer={<ManageTablePagination event={event} page={current} pageSize={pageSize} total={teams.length} hasNext={current < pages} busy={matrix.isPlaceholderData} onPrevious={() => setPage(current - 1)} onNext={() => setPage(current + 1)} onPageSize={size => {setPageSize(size); setPage(1);}} />}>
                    <tbody>{pageTeams.map(team => <tr key={team.TeamID}>
                        <td>{team.Name}</td>
                        <td className="ib-num">{number.format(team.Points)}</td>
                        {(matrixData?.Tasks ?? []).map(task => {
                            const item = cell?.(team.TeamID, task.ChallengeID);
                            if (!item || item.kind === "untouched") return <td key={task.ChallengeID}><span className="event-analytics-tasks__cell event-analytics-tasks__cell--untouched">—</span></td>;
                            return <td key={task.ChallengeID}>{item.kind === "solved" && item.solvedAt
                                ? <time className="event-analytics-tasks__cell event-analytics-tasks__cell--solved" dateTime={item.solvedAt} title={t("manage.analytics.progress.matrix.solvedTitle", {time: stamp.format(new Date(item.solvedAt)), attempts: item.attempts})}>{cellTime.format(new Date(item.solvedAt))}</time>
                                : <span className="event-analytics-tasks__cell event-analytics-tasks__cell--tried" title={t("manage.analytics.progress.matrix.triedTitle", {attempts: item.attempts})}>{item.attempts}</span>}</td>;
                        })}
                    </tr>)}</tbody>
                </ManageTable>
            </div>
        </SectionBlock>

        <SectionBlock title={t("manage.analytics.progress.heatmap.title")} subtitle={t("manage.analytics.progress.heatmap.subtitle")} hint={t("manage.analytics.progress.heatmap.hint")}>
            <AnalyticsChart event={event} state={chartStateOf(heatmap.isPending, !heatmap.data, !!heatmap.data && heatmapHasData(heatmap.data))} option={heatmap.data ? heatmapOption(heatmap.data) : undefined} height={420}
                ariaLabel={t("manage.analytics.progress.heatmap.title")} loadingLabel={t("manage.analytics.progress.loading")} errorMessage={t("manage.analytics.progress.loadFailed")} emptyMessage={t("manage.analytics.progress.heatmap.empty")} onRetry={() => void heatmap.refetch()} error={heatmap.error} />
        </SectionBlock>

        <SectionBlock title={t("manage.analytics.progress.inactive.title")} subtitle={t("manage.analytics.progress.inactive.subtitle")} hint={t("manage.analytics.progress.inactive.hint")}
            actions={<>
                <span className="event-analytics-tasks__inactive-controls">{t("manage.analytics.progress.inactive.threshold")}
                    <EventSelect ariaLabel={t("manage.analytics.progress.inactive.threshold")} value={String(minutes)} options={INACTIVE_OPTIONS.map(value => ({value: String(value), label: inactiveMinutesLabel(value)}))} onValueChange={value => setMinutes(Number(value))} />
                    <HelpButton label={t("manage.analytics.progress.inactive.threshold")} hint={t("manage.analytics.progress.inactive.thresholdHint")} />
                </span>
                <CsvButton eventID={eventID} path={inactiveExportPath(minutes)} name="analytics-progress-inactive" disabled={!idle} />
            </>}>
            <div className="event-analytics-tasks__table">
                <ManageTable event={event} state={idleState} busy={inactive.isPlaceholderData} loadingLabel={t("manage.analytics.progress.loading")} emptyMessage={idleEmpty} errorMessage={t("manage.analytics.progress.loadFailed")} onRetry={() => void inactive.refetch()} error={inactive.error}
                    head={<tr>
                        <th scope="col">{t("manage.analytics.progress.matrix.col.team")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.progress.matrix.col.points")}</th>
                        <th scope="col">{t("manage.analytics.progress.inactive.col.last")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.progress.inactive.col.idle")}</th>
                    </tr>}>
                    <tbody>{(idle?.Teams ?? []).map(team => <tr key={team.TeamID}>
                        <td>{team.Name}</td>
                        <td className="ib-num">{number.format(team.Points)}</td>
                        <td className="event-manage-table__nowrap">{team.LastActivityAt ? <time dateTime={team.LastActivityAt}>{stamp.format(new Date(team.LastActivityAt))}</time> : <span className="event-analytics-tasks__dim">{t("manage.analytics.progress.inactive.never")}</span>}</td>
                        <td className="ib-num">{formatDuration(team.IdleMinutes * 60)}</td>
                    </tr>)}</tbody>
                </ManageTable>
            </div>
        </SectionBlock>
    </AnalyticsPage>;
}
