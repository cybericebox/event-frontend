import type {ManageLifecycle} from "@/api/manage";
import {t} from "@/i18n/t";

// Mode 0 is static; 1–3 are the dynamic decays (by solves, by solve order, by time).
export type ScoringMode = 0 | 1 | 2 | 3;
export type DynamicProfile = {Mode: ScoringMode; MinPoints: number; MaxPoints: number; FloorAtPercent: number};

export const decayOptions = () => ([1, 2, 3] as const).map(mode => ({value: String(mode), label: t(`manage.challenges.scoring.decay.${mode}`)}));

// Why a dynamic decay cannot run with the event's lifecycle ("" = it can).
export function decayProblem(mode: number, lifecycle: Pick<ManageLifecycle, "JoinPolicy" | "FinishAt"> | undefined): string {
    if ((mode === 1 || mode === 2) && lifecycle?.JoinPolicy !== 0) return t("manage.scoring.needsJoinClose");
    if (mode === 3 && !lifecycle?.FinishAt) return t("manage.scoring.needsFinish");
    return "";
}

// An empty or partial number reads as NaN, which the validation reports.
export const numberOf = (value: string) => value.trim() === "" ? Number.NaN : Number(value);

export type DynamicErrors = {max: string; min: string; floor: string};

// Per-field errors of a dynamic profile ("" = fine): «Від» (max) above «До»
// (min), «До» a whole number of at least 1 (the server requires positive
// points), «Поріг, %» 1–100 (time decay has no threshold).
export function dynamicErrors(profile: DynamicProfile): DynamicErrors {
    const {Mode, MinPoints, MaxPoints, FloorAtPercent} = profile;
    const whole = (value: number) => Number.isInteger(value);
    const min = !whole(MinPoints) || MinPoints < 1 ? t("manage.challenges.scoring.minInvalid") : "";
    const max = !whole(MaxPoints) || MaxPoints < 1 ? t("manage.challenges.scoring.maxInvalid")
        : !min && MaxPoints <= MinPoints ? t("manage.challenges.scoring.maxAboveMin") : "";
    const floor = Mode === 3 || (whole(FloorAtPercent) && FloorAtPercent >= 1 && FloorAtPercent <= 100) ? "" : t("manage.challenges.scoring.floorInvalid");
    return {max, min, floor};
}

export function dynamicValid(profile: DynamicProfile): boolean {
    if (profile.Mode === 0) return true;
    const errors = dynamicErrors(profile);
    return !errors.max && !errors.min && !errors.floor;
}

export function staticPointsValid(value: string, required: boolean): boolean {
    const raw = value.trim();
    if (raw === "") return !required;
    const points = Number(raw);
    return Number.isInteger(points) && points > 0;
}

// «Статичне · 100 балів» / «Динамічне · 500 → 100».
export function scoringSummary(profile: DynamicProfile, staticPoints: number): string {
    if (profile.Mode !== 0) return t("manage.challenges.scoring.summaryDynamic", {max: profile.MaxPoints, min: profile.MinPoints});
    return t("manage.challenges.scoring.summaryStatic", {points: staticPoints});
}
