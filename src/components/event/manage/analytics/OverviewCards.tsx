"use client";

import {useEffect, useState, type ReactNode} from "react";
import {ArrowRight, CircleHelp} from "lucide-react";
import Link from "next/link";
import type {AnalyticsOverview as Overview} from "@/api/manageAnalytics";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {formatCount, formatDuration} from "./analyticsFormat";
import {eventPhase, eventProgress, percent} from "./analyticsModel";
import "./analytics.css";

// Where each card leads. The event site serves the manage pages at /manage.
export const sectionHref = {
    participants: "/manage/analytics/participants",
    tasks: "/manage/analytics/tasks",
    stands: "/manage/analytics/stands",
    communications: "/manage/analytics/communications",
    results: "/scoreboard",
} as const;

export type CardState = "loading" | "error" | "empty" | "ready";

// One card of the overview grid. Its body has a constant height, and its
// loading, error and empty states are centred inside it, so the card keeps its
// size while the data arrives. `link` is the section with the detail.
export function OverviewCard({event, title, subtitle, hint, link, state, loadingLabel, errorMessage, emptyMessage, onRetry, error, className = "", children}: {
    event: PublicEventInfo;
    title: string;
    subtitle?: string;
    hint?: string;
    link?: {href: string; label: string};
    state: CardState;
    loadingLabel: string;
    errorMessage: string;
    emptyMessage: string;
    onRetry?: () => void;
    error?: unknown;
    className?: string;
    children?: ReactNode;
}) {
    return <section className={`event-analytics__block event-analytics-card${className ? ` ${className}` : ""}`} aria-label={title}>
        <div className="event-analytics__block-head">
            <div>
                <h2>{title}{hint && <EventTooltip content={hint}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title})} aria-describedby={id}><CircleHelp size={14} /></button>}</EventTooltip>}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {link && <Link className="event-analytics-card__link" href={link.href}>{link.label}<ArrowRight size={14} aria-hidden="true" /></Link>}
        </div>
        <div className="event-analytics-card__body" aria-busy={state === "loading"}>
            {state === "loading" && <EventLoading event={event} label={loadingLabel} compact />}
            {state === "error" && <EventLoadError message={errorMessage} onRetry={onRetry} error={error} compact />}
            {state === "empty" && <EmptyState message={emptyMessage} compact />}
            {state === "ready" && children}
        </div>
    </section>;
}

// Rows of "label — value", each one a link to the section.
function FactRows({rows}: {rows: {key: string; label: string; value: ReactNode; href: string}[]}) {
    return <ul className="event-analytics-facts">{rows.map(row => <li key={row.key}>
        <Link href={row.href}><span className="event-analytics-facts__label">{row.label}</span><span className="event-analytics-facts__value">{row.value}</span></Link>
    </li>)}</ul>;
}

function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);
    return now;
}

// 200000 s → «2 д 7 год», shorter spans use the usual duration.
function span(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    if (days > 0) return t("manage.analytics.status.daysHours", {d: days, h: Math.floor((seconds % 86400) / 3600)});
    return formatDuration(seconds);
}

const secondsBetween = (from: number, to: number) => Math.max(0, Math.floor((to - from) / 1000));

function Progress({value, label}: {value: number; label: string}) {
    const share = Math.round(value * 100);
    return <div className="event-analytics-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share}>
        <span style={{width: `${share}%`}} />
    </div>;
}

// The strip on top: where the event is on the clock. Before the start it counts
// down and shows the registration; while running it shows elapsed / remaining
// with a progress bar; after the finish it shows the duration.
export function StatusStrip({overview}: {overview: Overview}) {
    const {Markers: markers, Participants: people} = overview;
    // A final report does not move; any other event ticks (the phase follows the clock).
    const now = useNow(!overview.Final);
    const phase = eventPhase(markers, overview.Final, now);
    const start = Date.parse(markers.StartAt);
    const finish = markers.FinishAt ? Date.parse(markers.FinishAt) : null;

    let title: string;
    let facts: {label: string; value: string}[];
    let progress: {value: number; label: string} | null = null;
    if (phase === "before") {
        title = t("manage.analytics.status.before");
        facts = [
            {label: t("manage.analytics.status.untilStart"), value: span(secondsBetween(now, start))},
            {label: t("manage.analytics.status.registered"), value: t("manage.analytics.status.registeredValue", {registered: formatCount(people.Registered), approved: formatCount(people.Approved)})},
        ];
        if (people.Registered > 0) progress = {value: people.Approved / people.Registered, label: t("manage.analytics.status.registrationProgress")};
    } else if (phase === "running") {
        title = t("manage.analytics.status.running");
        facts = [{label: t("manage.analytics.status.elapsed"), value: span(secondsBetween(start, now))}];
        if (finish !== null) facts.push({label: t("manage.analytics.status.remaining"), value: span(secondsBetween(now, finish))});
        const share = eventProgress(markers, now);
        if (share !== null) progress = {value: share, label: t("manage.analytics.status.timeProgress")};
    } else {
        title = t("manage.analytics.status.finished");
        facts = finish === null ? [] : [{label: t("manage.analytics.status.duration"), value: span(secondsBetween(start, finish))}];
    }
    return <section className={`event-analytics__block event-analytics-status event-analytics-status--${phase}`} aria-label={t("manage.analytics.status.label")}>
        <strong className="event-analytics-status__title">{title}</strong>
        <dl className="event-analytics-status__facts">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        {progress && <Progress {...progress} />}
    </section>;
}

type CardProps = {event: PublicEventInfo; overview?: Overview; state: "loading" | "error" | "ready"; onRetry: () => void; error?: unknown; teamMode: boolean};

const cardStates = (props: CardProps, empty: boolean): CardState => props.state === "ready" ? (empty ? "empty" : "ready") : props.state;

export function LeadersCard(props: CardProps) {
    const {event, overview, teamMode} = props;
    const leaders = overview?.Leaders ?? [];
    return <OverviewCard event={event} title={t(teamMode ? "manage.analytics.leaders.title" : "manage.analytics.leaders.titleSolo")} subtitle={t("manage.analytics.leaders.subtitle")} hint={t("manage.analytics.leaders.hint")}
        link={{href: sectionHref.results, label: t("manage.analytics.leaders.link")}} state={cardStates(props, leaders.length === 0)}
        loadingLabel={t("manage.analytics.leaders.loading")} errorMessage={t("manage.analytics.leaders.loadFailed")} emptyMessage={t(teamMode ? "manage.analytics.leaders.empty" : "manage.analytics.leaders.emptySolo")}
        onRetry={props.onRetry} error={props.error}>
        <ol className="event-analytics-leaders">{leaders.map(leader => <li key={leader.TeamID}>
            <span className="event-analytics-leaders__rank">{leader.Rank}</span>
            <span className="event-analytics-leaders__name">{leader.Name}</span>
            <span className="event-analytics-leaders__points">{t("manage.analytics.leaders.points", {points: formatCount(leader.Points)})}</span>
            <small className="event-analytics-leaders__gap">{leader.Rank === 1 ? t("manage.analytics.leaders.first") : t("manage.analytics.leaders.gap", {points: formatCount(leader.Gap)})}</small>
        </li>)}</ol>
    </OverviewCard>;
}

export function TasksCard(props: CardProps) {
    const {event, overview} = props;
    const tasks = overview?.Tasks;
    const link = {href: sectionHref.tasks, label: t("manage.analytics.tasksCard.link")};
    const solved = (task: {Name: string; Solves: number} | null) => task ? t("manage.analytics.tasksCard.solvedBy", {name: task.Name, count: task.Solves}) : t("manage.analytics.tasksCard.none");
    return <OverviewCard event={event} title={t("manage.analytics.tasksCard.title")} subtitle={t("manage.analytics.tasksCard.subtitle")} hint={t("manage.analytics.tasksCard.hint")} link={link} state={cardStates(props, tasks?.Total === 0)}
        loadingLabel={t("manage.analytics.tasksCard.loading")} errorMessage={t("manage.analytics.tasksCard.loadFailed")} emptyMessage={t("manage.analytics.tasksCard.empty")}
        onRetry={props.onRetry} error={props.error}>
        {tasks && <FactRows rows={[
            {key: "unsolved", label: t("manage.analytics.tasksCard.unsolved"), value: t("manage.analytics.tasksCard.unsolvedValue", {count: tasks.Unsolved, total: tasks.Total}), href: link.href},
            {key: "most", label: t("manage.analytics.tasksCard.most"), value: solved(tasks.MostSolved), href: link.href},
            {key: "least", label: t("manage.analytics.tasksCard.least"), value: solved(tasks.LeastSolved), href: link.href},
            {key: "bloods", label: t("manage.analytics.tasksCard.bloods"), value: t("manage.analytics.tasksCard.bloodsValue", {taken: tasks.FirstBloods, total: tasks.Total}), href: link.href},
        ]} />}
    </OverviewCard>;
}

export function EngagementCard(props: CardProps) {
    const {event, overview, teamMode} = props;
    const engagement = overview?.Engagement;
    const link = {href: sectionHref.participants, label: t("manage.analytics.engagement.link")};
    const average = new Intl.NumberFormat("uk-UA", {maximumFractionDigits: 1});
    return <OverviewCard event={event} title={t("manage.analytics.engagement.title")} subtitle={t("manage.analytics.engagement.subtitle")} hint={t("manage.analytics.engagement.hint")} link={link} state={cardStates(props, engagement?.Teams === 0)}
        loadingLabel={t("manage.analytics.engagement.loading")} errorMessage={t("manage.analytics.engagement.loadFailed")} emptyMessage={t(teamMode ? "manage.analytics.engagement.empty" : "manage.analytics.engagement.emptySolo")}
        onRetry={props.onRetry} error={props.error}>
        {overview && engagement && <FactRows rows={[
            {key: "active", label: t("manage.analytics.engagement.active"), value: t("manage.analytics.engagement.activeValue", {active: overview.Participants.Active, approved: overview.Participants.Approved}), href: link.href},
            {key: "solving", label: t(teamMode ? "manage.analytics.engagement.solving" : "manage.analytics.engagement.solvingSolo"), value: t("manage.analytics.engagement.solvingValue", {solving: engagement.TeamsSolving, total: engagement.Teams, share: percent(engagement.TeamsSolving, engagement.Teams)}), href: link.href},
            {key: "average", label: t(teamMode ? "manage.analytics.engagement.average" : "manage.analytics.engagement.averageSolo"), value: average.format(engagement.AvgSolves), href: link.href},
        ]} />}
    </OverviewCard>;
}

// Only for an event with stands; the page leaves the card out otherwise.
export function StandsCard(props: CardProps) {
    const {event, overview} = props;
    const stands = overview?.Stands;
    const link = {href: sectionHref.stands, label: t("manage.analytics.standsCard.link")};
    return <OverviewCard event={event} title={t("manage.analytics.standsCard.title")} subtitle={t("manage.analytics.standsCard.subtitle")} hint={t("manage.analytics.standsCard.hint")} link={link} state={cardStates(props, false)}
        loadingLabel={t("manage.analytics.standsCard.loading")} errorMessage={t("manage.analytics.standsCard.loadFailed")} emptyMessage=""
        onRetry={props.onRetry} error={props.error}>
        {stands && <div className="event-analytics-triple">
            <Link href={link.href}><strong>{formatCount(stands.Ready)}</strong><span>{t("manage.analytics.standsCard.ready")}</span></Link>
            <Link href={link.href}><strong>{formatCount(stands.Creating)}</strong><span>{t("manage.analytics.standsCard.creating")}</span></Link>
            <Link href={link.href} className={stands.Failed > 0 ? "event-analytics-triple__bad" : undefined}><strong>{formatCount(stands.Failed)}</strong><span>{t("manage.analytics.standsCard.failed")}</span></Link>
        </div>}
    </OverviewCard>;
}

// Only for the sensitive access: the server sends Comms as null to anyone else.
export function CommsCard(props: CardProps) {
    const {event, overview} = props;
    const comms = overview?.Comms;
    const link = {href: sectionHref.communications, label: t("manage.analytics.commsCard.link")};
    return <OverviewCard event={event} title={t("manage.analytics.commsCard.title")} subtitle={t("manage.analytics.commsCard.subtitle")} hint={t("manage.analytics.commsCard.hint")} link={link}
        state={cardStates(props, !!comms && comms.EmailSent + comms.EmailFailed === 0)}
        loadingLabel={t("manage.analytics.commsCard.loading")} errorMessage={t("manage.analytics.commsCard.loadFailed")} emptyMessage={t("manage.analytics.commsCard.empty")}
        onRetry={props.onRetry} error={props.error}>
        {comms && <div className="event-analytics-triple">
            <Link href={link.href}><strong>{formatCount(comms.EmailSent)}</strong><span>{t("manage.analytics.commsCard.sent")}</span></Link>
            <Link href={link.href} className={comms.EmailFailed > 0 ? "event-analytics-triple__bad" : undefined}><strong>{formatCount(comms.EmailFailed)}</strong><span>{t("manage.analytics.commsCard.failed")}</span></Link>
        </div>}
    </OverviewCard>;
}
