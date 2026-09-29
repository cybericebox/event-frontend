"use client";

import {useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {getAnalyticsTasks, type AnalyticsTaskRow} from "@/api/manageAnalyticsTasks";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageTable, ManageTableSearch, type ManageTableState} from "@/components/event/manage/ManageTable";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import type {ChartState} from "../analyticsModel";
import {AnalyticsChart} from "../AnalyticsChart";
import {AnalyticsExportButton} from "../AnalyticsExportButton";
import {AnalyticsPage} from "../AnalyticsPage";
import {AnalyticsPeriodFilter} from "../AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "../AnalyticsStat";
import {useAnalyticsPeriod} from "../useAnalyticsPeriod";
import {HelpHead, SectionBlock} from "./SectionBlock";
import {TaskDrawer} from "./TaskDrawer";
import {
    calibrationChartOption, calibrationHasData, difficultyLabel, emptyTaskFilters, filterTasks, formatDuration, formatPercent, groupName, groupOptions,
    taskFiltersActive, taskTotals, verdictLabel, verdictOptions, verdictTone, type TaskFilters, type VerdictFilter,
} from "./tasksModel";
import "./tasks.css";

// Polls a little slower than the server's 10 s report cache.
export const TASKS_POLL_SECONDS = 30;

const number = new Intl.NumberFormat("uk-UA");
const solveTime = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});

function VerdictTag({row}: {row: AnalyticsTaskRow}) {
    const verdict = row.Calibration.Verdict;
    if (verdict === "insufficient" || verdict === "unknown") return <span className="event-analytics-tasks__dim">{verdictLabel(verdict)}</span>;
    const expected = t("manage.analytics.tasks.expected", {min: formatPercent(row.Calibration.ExpectedMin), max: formatPercent(row.Calibration.ExpectedMax)});
    return <span className={`ib-tag ib-tag--sm ${verdictTone(verdict)}`} title={expected}>{verdictLabel(verdict)}</span>;
}

// «Завдання» (§6.3): the per-task table with the difficulty calibration and
// the group summary; a click on a task opens its drawer.
export function AnalyticsTasks() {
    const {event} = useManager();
    const eventID = event.EventID;
    const filter = useAnalyticsPeriod();
    const [filters, setFilters] = useState<TaskFilters>(emptyTaskFilters);
    const [openID, setOpenID] = useState<string | null>(null);
    const tasks = useQuery({
        queryKey: ["event-analytics-tasks", eventID, filter.period.from, filter.period.to],
        queryFn: () => getAnalyticsTasks(eventID, filter.period),
        refetchInterval: TASKS_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        // Changing the period keeps the page, and its filter, in place.
        placeholderData: keepPreviousData,
    });
    const data = tasks.data;
    const rows = filterTasks(data?.Tasks ?? [], filters);
    const totals = taskTotals(data?.Tasks ?? []);
    const filtered = taskFiltersActive(filters);
    const tableState: ManageTableState = tasks.isPending ? "loading" : !data ? "error" : rows.length === 0 ? "empty" : "ready";
    const calibrationState: ChartState = tasks.isPending ? "loading" : !data ? "error" : calibrationHasData(data.Tasks) ? "ready" : "empty";
    const groupsState: ManageTableState = tasks.isPending ? "loading" : !data ? "error" : data.Groups.length === 0 ? "empty" : "ready";
    const retry = () => void tasks.refetch();

    const status = <LiveStatus freshness={{kind: "polling", seconds: TASKS_POLL_SECONDS, failing: tasks.isError}} updatedAt={tasks.dataUpdatedAt} />;
    const actions = <>{status}<AnalyticsExportButton eventID={eventID} section="tasks" period={filter.period} disabled={!data} /></>;

    const toolbar = <>
        <ManageTableSearch value={filters.search} onChange={search => setFilters(current => ({...current, search}))} label={t("manage.analytics.tasks.search")} />
        <EventSelect ariaLabel={t("manage.analytics.tasks.filter.group")} value={filters.group} options={groupOptions(data?.Groups ?? [])} onValueChange={group => setFilters(current => ({...current, group}))} />
        <EventSelect ariaLabel={t("manage.analytics.tasks.filter.verdict")} value={filters.verdict} options={verdictOptions()} onValueChange={value => setFilters(current => ({...current, verdict: value as VerdictFilter}))} />
        {filtered && <button className="ib-btn ib-btn--sm" type="button" onClick={() => setFilters(emptyTaskFilters)}>{t("manage.analytics.tasks.filter.reset")}</button>}
    </>;

    return <AnalyticsPage title={t("manage.analytics.section.tasks.title")} description={t("manage.analytics.section.tasks.description")} actions={actions} filter={<AnalyticsPeriodFilter period={filter} />}>
        <AnalyticsStatGrid label={t("manage.analytics.tasks.stats.label")}>
            <AnalyticsStat label={t("manage.analytics.tasks.stat.tasks")} value={data ? number.format(totals.tasks) : "—"} note={data ? t("manage.analytics.tasks.stat.tasksNote", {solved: totals.solved}) : undefined} hint={t("manage.analytics.tasks.stat.tasksHint")} />
            <AnalyticsStat label={t("manage.analytics.tasks.stat.mismatches")} value={data ? number.format(totals.mismatches) : "—"} hint={t("manage.analytics.tasks.stat.mismatchesHint")} />
            <AnalyticsStat label={t("manage.analytics.tasks.stat.hints")} value={data ? number.format(totals.hints) : "—"} note={data ? t("manage.analytics.tasks.stat.hintsNote", {points: number.format(totals.hintPoints)}) : undefined} hint={t("manage.analytics.tasks.stat.hintsHint")} />
        </AnalyticsStatGrid>

        <ManageTable event={event} state={tableState} busy={tasks.isPlaceholderData}
            loadingLabel={t("manage.analytics.tasks.loading")} emptyMessage={filtered ? t("manage.analytics.tasks.emptyFiltered") : t("manage.analytics.tasks.empty")} errorMessage={t("manage.analytics.tasks.loadFailed")} onRetry={retry}
            toolbar={toolbar}
            head={<tr>
                <HelpHead label={t("manage.analytics.tasks.col.task")} hint={t("manage.analytics.tasks.col.taskHint")} />
                <HelpHead label={t("manage.analytics.tasks.col.difficulty")} hint={t("manage.analytics.tasks.col.difficultyHint")} />
                <HelpHead numeric label={t("manage.analytics.tasks.col.attempts")} hint={t("manage.analytics.tasks.col.attemptsHint")} />
                <HelpHead numeric label={t("manage.analytics.tasks.col.tried")} hint={t("manage.analytics.tasks.col.triedHint")} />
                <HelpHead numeric label={t("manage.analytics.tasks.col.solves")} hint={t("manage.analytics.tasks.col.solvesHint")} />
                <HelpHead numeric label={t("manage.analytics.tasks.col.rate")} hint={t("manage.analytics.tasks.col.rateHint")} />
                <HelpHead label={t("manage.analytics.tasks.col.calibration")} hint={t("manage.analytics.tasks.col.calibrationHint")} />
                <HelpHead numeric label={t("manage.analytics.tasks.col.sinceStart")} hint={t("manage.analytics.tasks.col.sinceStartHint")} />
                <HelpHead numeric label={t("manage.analytics.tasks.col.sinceOpen")} hint={t("manage.analytics.tasks.col.sinceOpenHint")} />
                <HelpHead label={t("manage.analytics.tasks.col.firstBlood")} hint={t("manage.analytics.tasks.col.firstBloodHint")} />
                <HelpHead numeric label={t("manage.analytics.tasks.col.hints")} hint={t("manage.analytics.tasks.col.hintsHint")} />
            </tr>}
            footer={<div className="event-manage-table__footer"><div className="event-manage-table__meta"><span>{t("manage.table.total", {count: rows.length})}</span></div></div>}>
            <tbody>{rows.map(row => <tr key={row.ChallengeID} className="is-clickable" onClick={() => setOpenID(row.ChallengeID)}>
                <td><button className="event-analytics-tasks__name" type="button" onClick={() => setOpenID(row.ChallengeID)}>
                    <span>{row.Name}</span><small>{groupName(row)} · {t("manage.analytics.tasks.points", {points: row.Points})}</small>
                </button></td>
                <td>{difficultyLabel(row.Difficulty)}</td>
                <td className="ib-num">{number.format(row.Attempts)}</td>
                <td className="ib-num">{number.format(row.TeamsTried)}</td>
                <td className="ib-num">{number.format(row.Solves)}</td>
                <td className="ib-num">{row.TeamsTried > 0 ? formatPercent(row.SolveRate) : "—"}</td>
                <td><VerdictTag row={row} /></td>
                <td className="ib-num">{formatDuration(row.MedianSinceStartSeconds)}</td>
                <td className="ib-num">{formatDuration(row.MedianSinceOpenSeconds)}</td>
                <td>{row.FirstBloodTeam ? <span className="event-analytics-tasks__name"><span>{row.FirstBloodTeam}</span>{row.FirstBloodAt && <small>{solveTime.format(new Date(row.FirstBloodAt))}</small>}</span> : <span className="event-analytics-tasks__dim">—</span>}</td>
                <td className="ib-num">{row.HintsOpened > 0 ? t("manage.analytics.tasks.hintsCell", {count: row.HintsOpened, points: row.HintPoints}) : "—"}</td>
            </tr>)}</tbody>
        </ManageTable>

        <SectionBlock title={t("manage.analytics.tasks.calibration.title")} subtitle={t("manage.analytics.tasks.calibration.subtitle")} hint={t("manage.analytics.tasks.calibration.hint")}>
            <AnalyticsChart event={event} state={calibrationState} option={data ? calibrationChartOption(data.Tasks) : undefined} height={320}
                ariaLabel={t("manage.analytics.tasks.calibration.title")} loadingLabel={t("manage.analytics.tasks.loading")} errorMessage={t("manage.analytics.tasks.loadFailed")} emptyMessage={t("manage.analytics.tasks.calibration.empty")} onRetry={retry} />
        </SectionBlock>

        <SectionBlock title={t("manage.analytics.tasks.groups.title")} subtitle={t("manage.analytics.tasks.groups.subtitle")} hint={t("manage.analytics.tasks.groups.hint")}>
            <div className="event-analytics-tasks__table">
                <ManageTable event={event} state={groupsState} loadingLabel={t("manage.analytics.tasks.loading")} emptyMessage={t("manage.analytics.tasks.groups.empty")} errorMessage={t("manage.analytics.tasks.loadFailed")} onRetry={retry}
                    head={<tr>
                        <th scope="col">{t("manage.analytics.tasks.groups.col.group")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.groups.col.tasks")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.col.attempts")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.groups.col.pairs")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.col.solves")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.col.rate")}</th>
                    </tr>}>
                    <tbody>{(data?.Groups ?? []).map(group => <tr key={group.GroupID}>
                        <td>{groupName(group)}</td>
                        <td className="ib-num">{number.format(group.Tasks)}</td>
                        <td className="ib-num">{number.format(group.Attempts)}</td>
                        <td className="ib-num">{number.format(group.TeamsTried)}</td>
                        <td className="ib-num">{number.format(group.Solves)}</td>
                        <td className="ib-num">{group.TeamsTried > 0 ? formatPercent(group.SolveRate) : "—"}</td>
                    </tr>)}</tbody>
                </ManageTable>
            </div>
        </SectionBlock>

        <TaskDrawer eventID={eventID} challengeID={openID} period={filter.period} onClose={() => setOpenID(null)} />
    </AnalyticsPage>;
}
