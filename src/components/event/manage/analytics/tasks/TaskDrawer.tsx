"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {useQuery} from "@tanstack/react-query";
import {X} from "lucide-react";
import type {AnalyticsPeriod} from "@/api/manageAnalytics";
import {getAnalyticsTaskDetail, getAnalyticsWrongAnswers, type AnalyticsHintGroup, type AnalyticsTaskDetail} from "@/api/manageAnalyticsTasks";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageTable, type ManageTableState} from "@/components/event/manage/ManageTable";
import {t} from "@/i18n/t";
import type {ChartState} from "../analyticsModel";
import {AnalyticsChart} from "../AnalyticsChart";
import {AnalyticsStat, AnalyticsStatGrid} from "../AnalyticsStat";
import {useAnalyticsAccess} from "../useAnalyticsAccess";
import {HelpButton} from "./SectionBlock";
import {detailHasActivity, difficultyLabel, formatDuration, formatPercent, groupName, solvesChartOption, verdictLabel, verdictTone} from "./tasksModel";
import "./tasks.css";

const number = new Intl.NumberFormat("uk-UA");
const stamp = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"});

function HintGroup({title, group, timeLabel}: {title: string; group: AnalyticsHintGroup; timeLabel: string}) {
    return <div className="event-analytics-tasks__compare">
        <h3>{title}</h3>
        <dl>
            <dt>{t("manage.analytics.tasks.detail.hint.teams")}</dt><dd>{number.format(group.Teams)}</dd>
            <dt>{t("manage.analytics.tasks.detail.hint.solved")}</dt><dd>{number.format(group.Solved)}</dd>
            <dt>{t("manage.analytics.tasks.detail.hint.rate")}</dt><dd>{group.Teams > 0 ? formatPercent(group.SolveRate) : "—"}</dd>
            <dt>{timeLabel}</dt><dd>{formatDuration(group.MedianSeconds)}</dd>
        </dl>
    </div>;
}

function Body({detail, eventID, period}: {detail: AnalyticsTaskDetail; eventID: string; period: AnalyticsPeriod}) {
    const {event} = useManager();
    const access = useAnalyticsAccess(eventID);
    const sensitive = access.data?.Sensitive === true;
    const task = detail.Task;
    const wrong = useQuery({
        queryKey: ["event-analytics-wrong-answers", eventID, task.ChallengeID, period.from, period.to],
        queryFn: () => getAnalyticsWrongAnswers(eventID, task.ChallengeID, period),
        enabled: sensitive, refetchOnWindowFocus: false, retry: false,
    });
    const chartState: ChartState = detailHasActivity(detail) ? "ready" : "empty";
    const failedState: ManageTableState = detail.FailedTeams.length === 0 ? "empty" : "ready";
    const wrongState: ManageTableState = wrong.isPending ? "loading" : !wrong.data ? "error" : wrong.data.Answers.length === 0 ? "empty" : "ready";
    return <>
        <AnalyticsStatGrid label={t("manage.analytics.tasks.detail.stats")}>
            <AnalyticsStat label={t("manage.analytics.tasks.col.tried")} value={number.format(task.TeamsTried)} note={t("manage.analytics.tasks.detail.attemptsNote", {attempts: number.format(task.Attempts)})} hint={t("manage.analytics.tasks.col.triedHint")} />
            <AnalyticsStat label={t("manage.analytics.tasks.col.solves")} value={number.format(task.Solves)} note={task.TeamsTried > 0 ? t("manage.analytics.tasks.detail.rateNote", {rate: formatPercent(task.SolveRate)}) : undefined} hint={t("manage.analytics.tasks.col.solvesHint")} />
            <AnalyticsStat label={t("manage.analytics.tasks.col.sinceStart")} value={formatDuration(task.MedianSinceStartSeconds)} note={t("manage.analytics.tasks.detail.sinceOpenNote", {time: formatDuration(task.MedianSinceOpenSeconds)})} hint={t("manage.analytics.tasks.col.sinceStartHint")} />
        </AnalyticsStatGrid>

        <section className="event-analytics-drawer__section" aria-label={t("manage.analytics.tasks.detail.solvesOverTime")}>
            <h3>{t("manage.analytics.tasks.detail.solvesOverTime")}<HelpButton label={t("manage.analytics.tasks.detail.solvesOverTime")} hint={t("manage.analytics.tasks.detail.solvesOverTimeHint")} /></h3>
            <div className="event-analytics__block">
                <AnalyticsChart event={event} state={chartState} option={solvesChartOption(detail)} height={280}
                    ariaLabel={t("manage.analytics.tasks.detail.solvesOverTime")} loadingLabel={t("manage.analytics.tasks.detail.loading")} errorMessage={t("manage.analytics.tasks.detail.loadFailed")} emptyMessage={t("manage.analytics.tasks.detail.chartEmpty")} />
            </div>
        </section>

        <section className="event-analytics-drawer__section" aria-label={t("manage.analytics.tasks.detail.hintEffect")}>
            <h3>{t("manage.analytics.tasks.detail.hintEffect")}<HelpButton label={t("manage.analytics.tasks.detail.hintEffect")} hint={t("manage.analytics.tasks.detail.hintEffectHint")} /></h3>
            <div className="event-analytics-tasks__two">
                <HintGroup title={t("manage.analytics.tasks.detail.hint.with")} group={detail.HintEffect.With} timeLabel={t("manage.analytics.tasks.detail.hint.timeAfterUnlock")} />
                <HintGroup title={t("manage.analytics.tasks.detail.hint.without")} group={detail.HintEffect.Without} timeLabel={t("manage.analytics.tasks.detail.hint.timeFromStart")} />
            </div>
        </section>

        <section className="event-analytics-drawer__section" aria-label={t("manage.analytics.tasks.detail.failed")}>
            <h3>{t("manage.analytics.tasks.detail.failed")}<HelpButton label={t("manage.analytics.tasks.detail.failed")} hint={t("manage.analytics.tasks.detail.failedHint")} /></h3>
            <div className="event-analytics-tasks__table event-analytics-tasks__table--drawer">
                <ManageTable event={event} state={failedState} loadingLabel={t("manage.analytics.tasks.detail.loading")} emptyMessage={t("manage.analytics.tasks.detail.failedEmpty")} errorMessage={t("manage.analytics.tasks.detail.loadFailed")} onRetry={() => undefined}
                    head={<tr>
                        <th scope="col">{t("manage.analytics.tasks.detail.col.team")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.col.attempts")}</th>
                        <th scope="col">{t("manage.analytics.tasks.detail.col.lastAttempt")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.detail.col.hints")}</th>
                    </tr>}>
                    <tbody>{detail.FailedTeams.map(team => <tr key={team.TeamID}>
                        <td>{team.TeamName}</td>
                        <td className="ib-num">{number.format(team.Attempts)}</td>
                        <td className="event-manage-table__nowrap"><time dateTime={team.LastAttemptAt}>{stamp.format(new Date(team.LastAttemptAt))}</time></td>
                        <td className="ib-num">{number.format(team.HintsOpened)}</td>
                    </tr>)}</tbody>
                </ManageTable>
            </div>
        </section>

        {sensitive && <section className="event-analytics-drawer__section" aria-label={t("manage.analytics.tasks.detail.wrong")}>
            <h3>{t("manage.analytics.tasks.detail.wrong")}<HelpButton label={t("manage.analytics.tasks.detail.wrong")} hint={t("manage.analytics.tasks.detail.wrongHint")} /></h3>
            <div className="event-analytics-tasks__table event-analytics-tasks__table--drawer">
                <ManageTable event={event} state={wrongState} loadingLabel={t("manage.analytics.tasks.detail.loading")} emptyMessage={t("manage.analytics.tasks.detail.wrongEmpty")} errorMessage={t("manage.analytics.tasks.detail.wrongFailed")} onRetry={() => void wrong.refetch()}
                    head={<tr>
                        <th scope="col">{t("manage.analytics.tasks.detail.col.answer")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.col.attempts")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.tasks.detail.col.teams")}</th>
                        <th scope="col">{t("manage.analytics.tasks.detail.col.lastAt")}</th>
                    </tr>}>
                    <tbody>{(wrong.data?.Answers ?? []).map(answer => <tr key={answer.Answer}>
                        <td className="ib-num">{answer.Answer}</td>
                        <td className="ib-num">{number.format(answer.Attempts)}</td>
                        <td className="ib-num">{number.format(answer.Teams)}</td>
                        <td className="event-manage-table__nowrap"><time dateTime={answer.LastAt}>{stamp.format(new Date(answer.LastAt))}</time></td>
                    </tr>)}</tbody>
                </ManageTable>
            </div>
        </section>}
    </>;
}

// The drawer of one task (§6.3): solves over time, the effect of hints, the
// teams that tried and failed and, for the sensitive access, the most common
// wrong answers. It has its own loading and error states, centred in the panel.
export function TaskDrawer({eventID, challengeID, period, onClose}: {eventID: string; challengeID: string | null; period: AnalyticsPeriod; onClose: () => void}) {
    const {event} = useManager();
    const detail = useQuery({
        queryKey: ["event-analytics-task", eventID, challengeID, period.from, period.to],
        queryFn: () => getAnalyticsTaskDetail(eventID, challengeID as string, period),
        enabled: challengeID !== null, refetchOnWindowFocus: false, retry: false,
    });
    const task = detail.data?.Task;
    return <DialogPrimitive.Root open={challengeID !== null} onOpenChange={open => {if (!open) onClose();}}>
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="ib-modal-backdrop event-modal-backdrop event-analytics-drawer-backdrop">
                <DialogPrimitive.Content className="ib-modal event-modal event-analytics-drawer" aria-describedby={undefined}>
                    <header className="ib-modal__head">
                        <div>
                            <DialogPrimitive.Title className="ib-modal__title">{task?.Name ?? t("manage.analytics.tasks.detail.title")}</DialogPrimitive.Title>
                            {task && <div className="event-analytics-drawer__meta">
                                <span className="ib-tag ib-tag--category">{groupName(task)}</span>
                                <span className="ib-tag">{difficultyLabel(task.Difficulty)}</span>
                                <span className="ib-tag">{t("manage.analytics.tasks.points", {points: task.Points})}</span>
                                {(task.Calibration.Verdict === "ok" || task.Calibration.Verdict === "too_easy" || task.Calibration.Verdict === "too_hard") && <span className={`ib-tag ${verdictTone(task.Calibration.Verdict)}`}>{verdictLabel(task.Calibration.Verdict)}</span>}
                            </div>}
                        </div>
                        <DialogPrimitive.Close className="ib-icon-btn ib-icon-btn--sm ib-modal__close" aria-label={t("common.close")}><X size={16} /></DialogPrimitive.Close>
                    </header>
                    <div className="ib-modal__body">
                        {detail.isPending && challengeID !== null && <div className="event-analytics-drawer__state"><EventLoading event={event} label={t("manage.analytics.tasks.detail.loading")} /></div>}
                        {detail.isError && <div className="event-analytics-drawer__state"><EventLoadError message={t("manage.analytics.tasks.detail.loadFailed")} error={detail.error} onRetry={() => void detail.refetch()} /></div>}
                        {detail.data && challengeID !== null && <Body detail={detail.data} eventID={eventID} period={period} />}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Overlay>
        </DialogPrimitive.Portal>
    </DialogPrimitive.Root>;
}
