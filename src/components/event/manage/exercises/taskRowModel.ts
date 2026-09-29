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
export function taskBadges(challenge: Pick<EventBoardChallenge, "Published" | "ScoringOverride" | "HintsEnabled" | "Hints">, stand: StandReadiness | null): TaskBadge[] {
    const badges: TaskBadge[] = [challenge.Published
        ? {key: "board", label: t("manage.exercises.challenge.onBoard"), tone: "ok"}
        : {key: "board", label: t("manage.exercises.challenge.hidden")}];
    if (challenge.ScoringOverride) badges.push({key: "scoring", label: t("manage.challenges.task.ownScoring")});
    if (challenge.HintsEnabled && challenge.Hints.length > 0) badges.push({key: "hints", label: t("manage.exercises.hints.title")});
    if (stand) badges.push(stand === "ready" ? {key: "stand", label: t("manage.challenges.task.standReady"), tone: "ok"} : {key: "stand", label: t("manage.challenges.task.standNotReady"), tone: "warn"});
    return badges;
}
