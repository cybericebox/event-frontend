import {ApiErrorCode} from "@/api/apiErrors";
import {ParticipantChallengeError, type ChallengeHint} from "@/api/participantChallenges";
import {t, tPlural} from "@/i18n/t";

export type HintChargeMode = "reward" | "balance";

export function pointsLabel(points: number): string {
    return tPlural("challenges.points", points);
}

// «−30 балів» or «безкоштовно».
export function hintCostLabel(cost: number): string {
    return cost > 0 ? t("challenges.hint.cost", {points: pointsLabel(cost)}) : t("challenges.hint.free");
}

// A paid hint asks first; a free one opens straight away.
export function hintNeedsConfirm(hint: Pick<ChallengeHint, "Cost" | "Unlocked">): boolean {
    return !hint.Unlocked && hint.Cost > 0;
}

// What the unlock does to the team's score, per the event's charge mode.
export function hintConfirmText(mode: HintChargeMode, cost: number): string {
    return mode === "balance"
        ? t("challenges.hint.confirmBalance", {points: pointsLabel(cost)})
        : t("challenges.hint.confirmReward", {points: pointsLabel(cost)});
}

export function hintModeNote(mode: HintChargeMode): string {
    return mode === "balance" ? t("challenges.hint.modeBalance") : t("challenges.hint.modeReward");
}

export function hintUnlockError(error: unknown): string {
    if (error instanceof ParticipantChallengeError) {
        if (error.code === ApiErrorCode.HintsDisabled) return t("challenges.hint.error.disabled");
        if (error.code === ApiErrorCode.HintNotFound) return t("challenges.hint.error.notFound");
        if (error.code === ApiErrorCode.ChallengeNotFound) return t("challenges.hint.error.challengeGone");
        if (error.code === ApiErrorCode.ChallengePrerequisites) return t("challenges.hint.error.prerequisites");
        if (error.code === ApiErrorCode.TeamNotAdmitted) return t("challenges.hint.error.notAdmitted");
        if (error.status === 409 || error.status === 403) return t("challenges.hint.error.unavailable");
    }
    return t("challenges.hint.error.failed");
}
