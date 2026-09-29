import {ApiErrorCode} from "@/api/apiErrors";
import {ParticipantChallengeError, type ChallengeHint} from "@/api/participantChallenges";
import {pluralUk} from "./challengeBoardModel";

export type HintChargeMode = "reward" | "balance";

export function pointsLabel(points: number): string {
    return `${points} ${pluralUk(points, "бал", "бали", "балів")}`;
}

// «−30 балів» or «безкоштовно».
export function hintCostLabel(cost: number): string {
    return cost > 0 ? `−${pointsLabel(cost)}` : "безкоштовно";
}

// A paid hint asks first; a free one opens straight away.
export function hintNeedsConfirm(hint: Pick<ChallengeHint, "Cost" | "Unlocked">): boolean {
    return !hint.Unlocked && hint.Cost > 0;
}

// What the unlock does to the team's score, per the event's charge mode.
export function hintConfirmText(mode: HintChargeMode, cost: number): string {
    return mode === "balance"
        ? `Відкриття одразу спише ${pointsLabel(cost)} з рахунку команди.`
        : `Відкриття зменшить винагороду за це завдання на ${pointsLabel(cost)}.`;
}

export function hintModeNote(mode: HintChargeMode): string {
    return mode === "balance" ? "Вартість підказки списується з балансу одразу." : "Платні підказки знижують винагороду за завдання.";
}

export function hintUnlockError(error: unknown): string {
    if (error instanceof ParticipantChallengeError) {
        if (error.code === ApiErrorCode.HintsDisabled) return "Підказки для цього завдання вимкнено";
        if (error.code === ApiErrorCode.HintNotFound) return "Підказку не знайдено. Оновіть сторінку";
        if (error.code === ApiErrorCode.ChallengeNotFound) return "Завдання більше недоступне";
        if (error.code === ApiErrorCode.ChallengePrerequisites) return "Спершу розвʼяжіть попередні завдання";
        if (error.code === ApiErrorCode.TeamNotAdmitted) return "Команду ще не допущено до завдань";
        if (error.status === 409 || error.status === 403) return "Підказки зараз недоступні";
    }
    return "Не вдалося відкрити підказку. Спробуйте ще раз";
}
