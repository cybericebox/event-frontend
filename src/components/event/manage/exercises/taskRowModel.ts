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

// Status badges of a collapsed task row (visibility is per set).
export function taskBadges(challenge: Pick<EventBoardChallenge, "ScoringOverride">, stand: StandReadiness | null): TaskBadge[] {
    const badges: TaskBadge[] = [];
    if (challenge.ScoringOverride) badges.push({key: "scoring", label: t("manage.challenges.task.ownScoring")});
    if (stand) badges.push(stand === "ready" ? {key: "stand", label: t("manage.challenges.task.standReady"), tone: "ok"} : {key: "stand", label: t("manage.challenges.task.standNotReady"), tone: "warn"});
    return badges;
}

export type SetStatus = "shown" | "hidden" | "broken";

// A set's state for its header icon (and its tasks in «Групи й порядок»):
// a set that needs missing infrastructure cannot work, whatever its visibility.
export function setStatus(challenges: Array<Pick<EventBoardChallenge, "Published">>, broken: boolean): SetStatus {
    if (broken) return "broken";
    return challenges.some(challenge => challenge.Published) ? "shown" : "hidden";
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

export type SetSummary = {hints: HintIndicator | null; ownScoring: boolean; stand: StandReadiness | null};

// A collapsed set's header: tasks with hints (muted when participants see
// hints in none of them), whether any task has its own scoring, and stand
// readiness over the tasks that have labs.
export function setSummary(challenges: Array<Pick<EventBoardChallenge, "HintsEnabled" | "Hints" | "ScoringOverride">>, hintsDisabled: boolean, stands: Array<StandReadiness | null>): SetSummary {
    const withHints = challenges.filter(challenge => challenge.Hints.length > 0);
    const shown = hintsDisabled ? 0 : withHints.filter(challenge => challenge.HintsEnabled).length;
    const count = withHints.length;
    const hints = count === 0 ? null : {
        count, shown: shown > 0,
        tooltip: hintsDisabled ? t("manage.challenges.set.hintsOffEvent", {count})
            : shown === 0 ? t("manage.challenges.set.hintsOffTasks", {count})
            : t("manage.challenges.set.hintsShown", {count, shown}),
    };
    const planned = stands.filter((stand): stand is StandReadiness => stand !== null);
    const stand = planned.length === 0 ? null : planned.every(item => item === "ready") ? "ready" : "notReady";
    return {hints, ownScoring: challenges.some(challenge => challenge.ScoringOverride !== null), stand};
}

// Sets start collapsed when there are more than three; the session keeps
// each set's open/closed choice.
export function setOpenByDefault(setCount: number): boolean {
    return setCount <= 3;
}
