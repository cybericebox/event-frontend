"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Download, Printer} from "lucide-react";
import {downloadManageFile} from "@/api/csvDownload";
import {getAnalyticsReport, REPORT_BUNDLE_PATH, reportFileName, type AnalyticsReport as Report, type ReportRank, type ReportTask} from "@/api/manageAnalyticsReport";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {ManageTable} from "@/components/event/manage/ManageTable";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {percent} from "./analyticsModel";
import {formatCount, formatDateTime, formatDuration, noValue} from "./analyticsFormat";
import {AnalyticsChart} from "./AnalyticsChart";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
import {funnelOption, rankingOption, reportActivityOption, reportHasActivity, taskRatesOption} from "./reportCharts";
import "./analyticsReport.css";

function ChartBlock({title, subtitle, option, ready, height = 300, emptyMessage}: {title: string; subtitle?: string; option: () => object; ready: boolean; height?: number; emptyMessage: string}) {
    const {event} = useManager();
    return <section className="event-analytics__block event-report__block" aria-label={title}>
        <div className="event-analytics__block-head"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <AnalyticsChart event={event} state={ready ? "ready" : "empty"} option={ready ? option() : undefined} height={height}
            ariaLabel={title} loadingLabel={t("manage.analytics.report.loading")} errorMessage={t("manage.analytics.report.loadFailed")} emptyMessage={emptyMessage} />
    </section>;
}

function KeyNumbers({report}: {report: Report}) {
    const stands = report.Stands;
    return <AnalyticsStatGrid label={t("manage.analytics.report.numbers.label")}>
        <AnalyticsStat label={t("manage.analytics.stat.registered")} value={formatCount(report.Participants.Registered)} note={t("manage.analytics.stat.registeredNote", {approved: report.Participants.Approved})} hint={t("manage.analytics.stat.registeredHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.teamsAdmitted")} value={formatCount(report.Teams.Admitted)} note={t("manage.analytics.stat.teamsIncomplete", {count: report.Teams.Incomplete})} hint={t("manage.analytics.stat.teamsAdmittedHint")} />
        <AnalyticsStat label={t("manage.analytics.report.stat.tasks")} value={formatCount(report.Tasks)} hint={t("manage.analytics.report.stat.tasksHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.attempts")} value={formatCount(report.Attempts)} note={t("manage.analytics.stat.attemptsNote", {correct: report.Correct, share: percent(report.Correct, report.Attempts)})} hint={t("manage.analytics.stat.attemptsHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.solves")} value={formatCount(report.Solves)} hint={t("manage.analytics.stat.solvesHint")} />
        <AnalyticsStat label={t("manage.analytics.stat.hints")} value={formatCount(report.HintsOpened)} note={t("manage.analytics.stat.hintsNote", {points: formatCount(report.HintPoints)})} hint={t("manage.analytics.stat.hintsHint")} />
        {stands && <AnalyticsStat label={t("manage.analytics.report.stat.stands")} value={`${formatCount(stands.Ready)} / ${formatCount(stands.Teams)}`} note={t("manage.analytics.report.stat.standsNote", {failed: stands.Failed, failures: stands.Failures, deploy: formatDuration(stands.DeployAvgSeconds)})} hint={t("manage.analytics.report.stat.standsHint")} />}
    </AnalyticsStatGrid>;
}

function RankingTable({rows}: {rows: ReportRank[]}) {
    const {event} = useManager();
    return <ManageTable event={event} state={rows.length === 0 ? "empty" : "ready"} loadingLabel={t("manage.analytics.report.loading")} errorMessage={t("manage.analytics.report.loadFailed")}
        emptyMessage={t("manage.analytics.report.ranking.empty")} onRetry={() => undefined}
        head={<tr>
            <th scope="col">{t("manage.analytics.report.col.rank")}</th>
            <th scope="col">{t("manage.analytics.report.col.team")}</th>
            <th scope="col">{t("manage.analytics.report.col.points")}</th>
            <th scope="col">{t("manage.analytics.report.col.solved")}</th>
            <th scope="col">{t("manage.analytics.report.col.attempts")}</th>
            <th scope="col">{t("manage.analytics.report.col.lastSolve")}</th>
        </tr>}>
        <tbody>{rows.map(row => <tr key={row.TeamID}>
            <td><strong>{row.Rank}</strong></td>
            <td><div className="event-manage-table__person"><strong>{row.Name}</strong>{!row.Individual && <small>{t("manage.analytics.report.members", {count: row.Members})}</small>}</div></td>
            <td>{formatCount(row.Points)}</td>
            <td>{formatCount(row.Solved)}</td>
            <td>{formatCount(row.Attempts)}</td>
            <td className="event-manage-table__nowrap">{formatDateTime(row.LastSolveAt)}</td>
        </tr>)}</tbody>
    </ManageTable>;
}

function TasksTable({rows}: {rows: ReportTask[]}) {
    const {event} = useManager();
    return <ManageTable event={event} state={rows.length === 0 ? "empty" : "ready"} loadingLabel={t("manage.analytics.report.loading")} errorMessage={t("manage.analytics.report.loadFailed")}
        emptyMessage={t("manage.analytics.report.tasks.empty")} onRetry={() => undefined}
        head={<tr>
            <th scope="col">{t("manage.analytics.report.col.task")}</th>
            <th scope="col">{t("manage.analytics.report.col.points")}</th>
            <th scope="col">{t("manage.analytics.report.col.teamsTried")}</th>
            <th scope="col">{t("manage.analytics.report.col.solves")}</th>
            <th scope="col">{t("manage.analytics.report.col.solveRate")}</th>
            <th scope="col">{t("manage.analytics.report.col.attempts")}</th>
            <th scope="col">{t("manage.analytics.report.col.hints")}</th>
            <th scope="col">{t("manage.analytics.report.col.firstBlood")}</th>
        </tr>}>
        <tbody>{rows.map(row => <tr key={row.ChallengeID}>
            <td><strong>{row.Name}</strong></td>
            <td>{formatCount(row.Points)}</td>
            <td>{formatCount(row.TeamsAttempted)}</td>
            <td>{formatCount(row.Solves)}</td>
            <td>{row.TeamsAttempted > 0 ? `${Math.round(row.SolveRate * 100)}%` : noValue}</td>
            <td>{formatCount(row.Attempts)}</td>
            <td>{formatCount(row.HintsUnlocked)}</td>
            <td><div className="event-manage-table__person"><strong>{row.FirstSolveTeam || noValue}</strong>{row.FirstSolveAt && <small>{formatDateTime(row.FirstSolveAt)}</small>}</div></td>
        </tr>)}</tbody>
    </ManageTable>;
}

// «Звіт по заході» (§6.8): the summary of a finished event. It is a normal
// page on screen and a clean document in print: the browser's «Зберегти як PDF»
// makes the PDF (the backend has no PDF renderer); the tables come as a ZIP of CSV.
export function AnalyticsReport() {
    const {event} = useManager();
    const eventID = event.EventID;
    const [downloading, setDownloading] = useState(false);
    const query = useQuery({queryKey: ["event-analytics-report", eventID], queryFn: () => getAnalyticsReport(eventID), refetchInterval: false, refetchOnWindowFocus: false});
    const report = query.data;
    const title = t("manage.analytics.section.report.title");
    const description = t("manage.analytics.section.report.description");
    const ready = report?.Available === true;

    async function download() {
        setDownloading(true);
        try {await downloadManageFile(eventID, REPORT_BUNDLE_PATH, reportFileName(), "application/zip");}
        catch {toast.error(t("manage.analytics.exportFailed"));}
        finally {setDownloading(false);}
    }

    const actions = <div className="event-report__actions">
        <button className="ib-btn" type="button" disabled={!ready} onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> {t("manage.analytics.report.print")}</button>
        <EventButton className="ib-btn" type="button" disabled={!ready || downloading} busy={downloading} onClick={() => void download()}><Download size={16} aria-hidden="true" /> {t("manage.analytics.report.download")}</EventButton>
    </div>;

    if (query.isPending) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoading event={event} label={t("manage.analytics.report.loading")} /></div>
    </AnalyticsPage>;
    if (!report) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.report.loadFailed")} error={query.error} onRetry={() => void query.refetch()} /></div>
    </AnalyticsPage>;
    if (!report.Available) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EmptyState message={t("manage.analytics.report.notReady")} /></div>
    </AnalyticsPage>;

    return <AnalyticsPage title={title} description={description} actions={actions} className="event-report">
        <header className="event-report__head">
            <h2>{report.EventName}</h2>
            <p>{t("manage.analytics.report.period", {from: formatDateTime(report.StartAt), to: formatDateTime(report.FinishAt)})}</p>
            <p>{t("manage.analytics.report.generated", {at: formatDateTime(report.GeneratedAt)})}</p>
        </header>
        <KeyNumbers report={report} />
        <div className="event-analytics__columns event-report__columns">
            <ChartBlock title={t("manage.analytics.report.funnel.participants.title")} subtitle={t("manage.analytics.report.funnel.participants.subtitle")} option={() => funnelOption(report.ParticipantFunnel, "participants")} ready={report.ParticipantFunnel.some(step => step.Count > 0)} height={220} emptyMessage={t("manage.analytics.report.funnel.empty")} />
            <ChartBlock title={t("manage.analytics.report.funnel.teams.title")} subtitle={t("manage.analytics.report.funnel.teams.subtitle")} option={() => funnelOption(report.TeamFunnel, "teams")} ready={report.TeamFunnel.some(step => step.Count > 0)} height={220} emptyMessage={t("manage.analytics.report.funnel.empty")} />
        </div>
        <section className="event-report__section" aria-label={t("manage.analytics.report.ranking.title")}>
            <div className="event-analytics__block-head"><h2>{t("manage.analytics.report.ranking.title")}</h2><p>{t("manage.analytics.report.ranking.subtitle")}</p></div>
            <ChartBlock title={t("manage.analytics.report.ranking.chart")} option={() => rankingOption(report)} ready={report.Ranking.some(row => row.Points > 0)} height={320} emptyMessage={t("manage.analytics.report.ranking.empty")} />
            <RankingTable rows={report.Ranking} />
        </section>
        <section className="event-report__section" aria-label={t("manage.analytics.report.tasks.title")}>
            <div className="event-analytics__block-head"><h2>{t("manage.analytics.report.tasks.title")}</h2><p>{t("manage.analytics.report.tasks.subtitle")}</p></div>
            <ChartBlock title={t("manage.analytics.report.tasks.chart")} option={() => taskRatesOption(report)} ready={report.TaskRows.some(row => row.TeamsAttempted > 0)} height={320} emptyMessage={t("manage.analytics.report.tasks.chartEmpty")} />
            <TasksTable rows={report.TaskRows} />
        </section>
        <ChartBlock title={t("manage.analytics.report.activity.title")} subtitle={t("manage.analytics.report.activity.subtitle")} option={() => reportActivityOption(report)} ready={reportHasActivity(report)} height={320} emptyMessage={t("manage.analytics.chart.empty")} />
    </AnalyticsPage>;
}
