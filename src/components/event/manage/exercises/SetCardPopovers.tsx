"use client";

import {Network} from "lucide-react";
import type {ManageScoring} from "@/api/manage";
import type {EventBoardChallenge, TaskResources} from "@/api/manageChallenges";
import {t} from "@/i18n/t";
import {InfoPopover} from "./CatalogStats";
import {hasResources, resourceRanges} from "./resourceModel";
import type {StandReadiness} from "./taskRowModel";

// The infrastructure mark of a set card: the catalog's three-node icon; a click or tap opens the lab's resources
// (CPU, memory, devices over the variants) and the stand state.
export function InfrastructurePopover({resources, stand}: {resources: TaskResources | null; stand: StandReadiness | null}) {
    const ranges = hasResources(resources) ? resourceRanges(resources) : null;
    return <InfoPopover label={t("manage.exercises.infra.open")} title={t("manage.exercises.infra.title")} triggerClassName={`event-exercise-infra-trigger${stand === "notReady" ? " is-warn" : ""}`}
        trigger={<Network size={16} aria-hidden="true" />}>
        {ranges ? <dl className="event-set-popover__facts">
            <div><dt>{t("manage.exercises.infra.cpu")}</dt><dd>{ranges.cpu}</dd></div>
            <div><dt>{t("manage.exercises.infra.memory")}</dt><dd>{ranges.memory}</dd></div>
            <div><dt>{t("manage.exercises.infra.devices")}</dt><dd>{ranges.devices}</dd></div>
        </dl> : <p className="event-subtask-count__empty">{t("manage.exercises.infra.unknown")}</p>}
        {stand && <p className={`event-set-popover__stand${stand === "notReady" ? " is-warn" : ""}`}>{t(stand === "ready" ? "manage.challenges.task.standReady" : "manage.challenges.task.standNotReady")}</p>}
    </InfoPopover>;
}

type Profile = {Mode: number; MinPoints: number; MaxPoints: number};

// «Статичне · 300 балів», «Динамічне · 500 → 100».
function profileText(profile: Profile, points: number | null): string {
    if (profile.Mode !== 0) return t("manage.challenges.scoring.summaryDynamic", {max: profile.MaxPoints, min: profile.MinPoints});
    return points === null ? t("manage.exercises.scoringInfo.staticOwn") : t("manage.challenges.scoring.summaryStatic", {points});
}

const decayText = (mode: number) => mode !== 0 ? t("manage.exercises.scoringInfo.decay", {decay: t(`manage.challenges.scoring.decay.${mode}`)}) : null;

// The set's scoring in one word: its tasks' own scoring when any has one (and the event does not force its own).
const ownScoring = (tasks: EventBoardChallenge[], scoring: ManageScoring) => !scoring.ForceEventScoring && tasks.some(task => task.ScoringOverride);

export function scoringBadge(tasks: EventBoardChallenge[], scoring: ManageScoring): string {
    return ownScoring(tasks, scoring) ? t("manage.challenges.task.ownScoring") : t("manage.challenges.task.scoringEvent");
}

// The scoring badge of a set card; a click or tap opens the details: the event's scoring, and every task's own one.
export function ScoringPopover({tasks, scoring}: {tasks: EventBoardChallenge[]; scoring: ManageScoring}) {
    const badge = scoringBadge(tasks, scoring);
    const own = scoring.ForceEventScoring ? [] : tasks.filter(task => task.ScoringOverride);
    const eventDecay = decayText(scoring.Mode);
    return <InfoPopover label={t("manage.exercises.scoringInfo.open", {badge})} title={t("manage.exercises.scoringInfo.title")} triggerClassName="ib-tag ib-tag--sm event-set-popover__badge"
        trigger={<><span className="event-set-popover__long">{badge}</span><span className="event-set-popover__short" aria-hidden="true">{t(ownScoring(tasks, scoring) ? "manage.exercises.scoringInfo.ownShort" : "manage.exercises.scoringInfo.eventShort")}</span></>}>
        <p className="event-set-popover__line">{t("manage.exercises.scoringInfo.event", {summary: profileText(scoring, scoring.StaticPoints)})}</p>
        {eventDecay && <p className="event-set-popover__note">{eventDecay}</p>}
        {scoring.ForceEventScoring && <p className="event-set-popover__note">{t("manage.challenges.task.scoringForcedNotice")}</p>}
        {own.length > 0 && <>
            <p className="event-set-popover__line">{t("manage.exercises.scoringInfo.tasks")}</p>
            <ul className="event-subtask-count__list">{own.map(task => {
                const override = task.ScoringOverride!;
                const decay = decayText(override.Mode);
                return <li key={task.ID}>{t("manage.exercises.scoringInfo.task", {name: task.Snapshot.name, summary: profileText(override, task.Points)})}{decay && <span className="event-set-popover__note"> · {decay}</span>}</li>;
            })}</ul>
        </>}
    </InfoPopover>;
}
