"use client";

import {useState, type ReactNode} from "react";
import {Trophy} from "lucide-react";
import type {ParticipationSolve} from "@/api/participationStats";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {AnalyticsChart} from "@/components/event/manage/analytics/AnalyticsChart";
import {AnalyticsStat, AnalyticsStatGrid} from "@/components/event/manage/analytics/AnalyticsStat";
import type {ChartState} from "@/components/event/manage/analytics/analyticsModel";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {categoryChartOption, pointsChartOption, type PointsSeries} from "./participationCharts";
import {categoryBreakdown, exactTime, relativeTime, successRate, wrongAttempts} from "./participationStatsModel";

export type BlockState = "loading" | "error" | "empty" | "ready";

export function Card({title, note, actions, children, foot, flush = false, id}: {title: string; note?: ReactNode; actions?: ReactNode; children: ReactNode; foot?: ReactNode; flush?: boolean; id?: string}) {
    return <section className="event-pp-card" aria-label={title} id={id}>
        <header className="event-pp-card__head"><h2>{title}</h2>{note && <p>{note}</p>}{actions && <div className="event-pp-card__actions">{actions}</div>}</header>
        <div className={`event-pp-card__body${flush ? " event-pp-card__body--flush" : ""}`}>{children}</div>
        {foot && <div className="event-pp-card__foot">{foot}</div>}
    </section>;
}

// The loading / error / empty states of a data block, centred in the block's own frame.
export function BlockStates({state, event, loadingLabel, errorMessage, emptyMessage, onRetry, error, height = 240}: {
    state: Exclude<BlockState, "ready">; event: PublicEventInfo; loadingLabel: string; errorMessage: string; emptyMessage: string; onRetry?: () => void; error?: unknown; height?: number;
}) {
    return <div className="event-pp-state" style={{"--event-block-state-h": `${height}px`} as React.CSSProperties}>
        {state === "loading" && <EventLoading event={event} label={loadingLabel} />}
        {state === "error" && <EventLoadError message={errorMessage} onRetry={onRetry} error={error} />}
        {state === "empty" && <EmptyState message={emptyMessage} />}
    </div>;
}

export type Tile = {key: string; label: string; value: string; hint: string; note?: string};

export function StatTiles({label, tiles}: {label: string; tiles: Tile[]}) {
    return <AnalyticsStatGrid label={label}>{tiles.map(tile => <AnalyticsStat key={tile.key} label={tile.label} value={tile.value} hint={tile.hint} note={tile.note} />)}</AnalyticsStatGrid>;
}

const numberFormat = new Intl.NumberFormat("uk-UA");
export const formatNumber = (value: number) => numberFormat.format(value);

// The five counters of the participant, or the team's: solves, points, first bloods, hints and attempts with the success rate.
export function statTiles({solves, points, firstBloods, hints, attempts, correct, scope}: {solves: number; points: number; firstBloods: number; hints: number; attempts: number; correct: number; scope: "me" | "team"} ): Tile[] {
    const rate = successRate(correct, attempts);
    return [
        {key: "solves", label: t("participation.stats.solves"), value: formatNumber(solves), hint: t(`participation.stats.solves.hint.${scope}`)},
        {key: "points", label: t("participation.stats.points"), value: formatNumber(points), hint: t(`participation.stats.points.hint.${scope}`)},
        {key: "firstBloods", label: t("participation.stats.firstBloods"), value: formatNumber(firstBloods), hint: t("participation.stats.firstBloods.hint")},
        {key: "hints", label: t("participation.stats.hints"), value: formatNumber(hints), hint: t("participation.stats.hints.hint")},
        {key: "attempts", label: t("participation.stats.attempts"), value: formatNumber(attempts), note: rate === null ? undefined : t("participation.stats.attempts.rate", {rate}), hint: t("participation.stats.attempts.hint")},
    ];
}

const pointsAria = (name: string) => name;

export function PointsChartCard({event, title, state, series, window, error, onRetry, ariaLabel}: {
    event: PublicEventInfo; title: string; state: ChartState; series: PointsSeries[]; window: {from: number; to: number}; error?: unknown; onRetry?: () => void; ariaLabel?: string;
}) {
    return <Card title={title} flush>
        <AnalyticsChart event={event} state={state} option={state === "ready" ? pointsChartOption(series, window) : undefined} height={300} ariaLabel={pointsAria(ariaLabel ?? title)}
            loadingLabel={t("participation.chart.loading")} errorMessage={t("participation.chart.failed")} emptyMessage={t("participation.chart.points.empty")} onRetry={onRetry} error={error} />
    </Card>;
}

export function CategoryChartCard({event, state, solves, color, error, onRetry}: {event: PublicEventInfo; state: ChartState; solves: ParticipationSolve[]; color: string; error?: unknown; onRetry?: () => void}) {
    const shares = categoryBreakdown(solves);
    return <Card title={t("participation.chart.category.title")} flush>
        <AnalyticsChart event={event} state={state} option={state === "ready" ? categoryChartOption(shares, color) : undefined} height={300} ariaLabel={t("participation.chart.category.title")}
            loadingLabel={t("participation.chart.loading")} errorMessage={t("participation.chart.failed")} emptyMessage={t("participation.chart.category.empty")} onRetry={onRetry} error={error} />
    </Card>;
}

// Solves vs wrong attempts: only the counts, never the answers.
export function RatioBar({correct, attempts}: {correct: number; attempts: number}) {
    const wrong = wrongAttempts(correct, attempts);
    const okShare = attempts > 0 ? (correct / attempts) * 100 : 0;
    const rate = successRate(correct, attempts);
    return <div className="event-pp-ratio">
        <div className="event-pp-ratio__bar" role="img" aria-label={t("participation.ratio.aria", {correct, wrong})}>
            <span className="event-pp-ratio__ok" style={{width: `${okShare}%`}} /><span className="event-pp-ratio__bad" style={{width: `${attempts > 0 ? 100 - okShare : 0}%`}} />
        </div>
        <dl className="event-pp-ratio__legend">
            <div><dt>{t("participation.ratio.correct")}</dt><dd>{formatNumber(correct)}</dd></div>
            <div><dt>{t("participation.ratio.wrong")}</dt><dd>{formatNumber(wrong)}</dd></div>
            {rate !== null && <div><dt>{t("participation.ratio.rate")}</dt><dd>{rate}%</dd></div>}
        </dl>
    </div>;
}

export function TimeCell({iso, now}: {iso: string; now: number}) {
    return <EventTooltip content={exactTime(iso)}>{id => <time className="event-pp-time" dateTime={iso} aria-describedby={id} tabIndex={0}>{relativeTime(iso, now)}</time>}</EventTooltip>;
}

const PAGE = 10;

// Solved tasks, newest first: task, category, points, time, the solver in a team, a first-blood mark. Wrong attempts are never listed.
export function SolvesTable({event, state, solves, now, showSolver, error, onRetry, title}: {
    event: PublicEventInfo; state: BlockState; solves: ParticipationSolve[]; now: number; showSolver: boolean; error?: unknown; onRetry?: () => void; title: string;
}) {
    const [shown, setShown] = useState(PAGE);
    const rows = [...solves].sort((a, b) => Date.parse(b.SolvedAt) - Date.parse(a.SolvedAt));
    return <Card title={title} note={state === "ready" ? t("participation.solves.count", {count: solves.length}) : undefined} flush>
        {state !== "ready" ? <BlockStates state={state} event={event} loadingLabel={t("participation.solves.loading")} errorMessage={t("participation.solves.failed")} emptyMessage={t("participation.solves.empty")} onRetry={onRetry} error={error} height={280} /> : <>
            <div className="event-pp-table__scroll"><table className="event-pp-table"><thead><tr>
                <th>{t("participation.solves.task")}</th><th>{t("participation.solves.category")}</th><th className="is-num">{t("participation.solves.points")}</th>
                {showSolver && <th>{t("participation.solves.solver")}</th>}<th className="is-nowrap">{t("participation.solves.time")}</th>
            </tr></thead><tbody>{rows.slice(0, shown).map(solve => <tr key={`${solve.EventChallengeID}-${solve.SolvedAt}`}>
                <td><span className="event-pp-table__name">{solve.ChallengeName}{solve.FirstBlood && <span className="ib-tag ib-tag--sm ib-tag--warn"><Trophy size={12} aria-hidden="true" />{t("participation.solves.firstBlood")}</span>}</span></td>
                <td><span className="ib-tag ib-tag--category">{solve.Category}</span></td>
                <td className="is-num">{formatNumber(solve.Points)}</td>
                {showSolver && <td>{solve.SolvedByName || "—"}</td>}
                <td className="is-nowrap"><TimeCell iso={solve.SolvedAt} now={now} /></td>
            </tr>)}</tbody></table></div>
            {rows.length > shown && <div className="event-pp-more"><button type="button" className="ib-btn ib-btn--sm" onClick={() => setShown(current => current + PAGE)}>{t("participation.solves.more", {count: rows.length - shown})}</button></div>}
        </>}
    </Card>;
}
