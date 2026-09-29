import type {ManageLabs} from "@/api/manageLabs";
import type {EventBoardChallenge} from "@/api/manageChallenges";
import {t} from "@/i18n/t";

export type StandReadiness = "ready" | "notReady";
export type TaskBadge = {key: string; label: string; tone?: "ok" | "warn"};

// A task's stand is ready when every team's lab of it is ready; null when the
// task has no labs (no infrastructure, or none planned yet).
export function standReadiness(challengeID: string, labs: ManageLabs | undefined): StandReadiness | null {
    const entries = (labs?.Items ?? []).flatMap(stand => stand.Labs).filter(lab => lab.ChallengeID === challengeID);
    if (entries.length === 0) return null;
    return entries.every(lab => lab.Status === "ready") ? "ready" : "notReady";
}

// Status badges of a collapsed task row.
export function taskBadges(challenge: Pick<EventBoardChallenge, "Published" | "ScoringOverride">, stand: StandReadiness | null): TaskBadge[] {
    const badges: TaskBadge[] = [challenge.Published
        ? {key: "board", label: t("manage.exercises.challenge.onBoard"), tone: "ok"}
        : {key: "board", label: t("manage.exercises.challenge.hidden")}];
    if (challenge.ScoringOverride) badges.push({key: "scoring", label: t("manage.challenges.task.ownScoring")});
    if (stand) badges.push(stand === "ready" ? {key: "stand", label: t("manage.challenges.task.standReady"), tone: "ok"} : {key: "stand", label: t("manage.challenges.task.standNotReady"), tone: "warn"});
    return badges;
}

export type HintIndicator = {count: number; shown: boolean; tooltip: string};

// The collapsed row's hint indicator: shown only when the task has hints;
// hidden (muted) when the task has them off or the event disables them all.
export function hintIndicator(challenge: Pick<EventBoardChallenge, "HintsEnabled" | "Hints">, hintsDisabled: boolean): HintIndicator | null {
    const count = challenge.Hints.length;
    if (count === 0) return null;
    if (hintsDisabled) return {count, shown: false, tooltip: t("manage.challenges.task.hintsOffEvent", {count})};
    if (!challenge.HintsEnabled) return {count, shown: false, tooltip: t("manage.challenges.task.hintsOffTask", {count})};
    return {count, shown: true, tooltip: t("manage.challenges.task.hintsShown", {count})};
}
