import type {ManageScoring} from "@/api/manage";
import type {EventBoardChallenge} from "@/api/manageChallenges";
import {t, tPlural} from "@/i18n/t";

const difficulties = new Set(["elementary", "trivial", "easy", "medium", "hard", "insane"]);

type GroupTask = Pick<EventBoardChallenge, "EffectivePoints" | "ScoringOverride"> & {Snapshot: {difficulty?: string}};

// The difficulty of a task in the group order, the same label as the rest of the panel; nothing when unknown.
export function groupTaskDifficulty(task: GroupTask): string {
    const difficulty = task.Snapshot.difficulty ?? "";
    return difficulties.has(difficulty) ? t(`manage.exercises.difficulty.${difficulty}`) : "";
}

// What a team scores for the task: the static points («150 балів»), or the dynamic range («динамічні 500→100»)
// of the task's own scoring or of the event's when the task follows it. Nothing until the event scoring is known.
export function groupTaskPoints(task: GroupTask, scoring: ManageScoring | undefined): string {
    if (!scoring) return "";
    const own = !scoring.ForceEventScoring ? task.ScoringOverride : null;
    const profile = own ?? (scoring.Mode !== 0 ? scoring : null);
    if (profile && profile.Mode !== 0) return t("manage.challenges.groups.pointsDynamic", {max: profile.MaxPoints, min: profile.MinPoints});
    return tPlural("manage.challenges.groups.points", task.EffectivePoints);
}
