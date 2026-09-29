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

// Dynamic: max → min with a positive min; the floor (1–100 %) only for 1 and 2.
export function dynamicValid(profile: DynamicProfile): boolean {
    const {Mode, MinPoints, MaxPoints, FloorAtPercent} = profile;
    if (Mode === 0) return true;
    return Number.isInteger(MinPoints) && MinPoints > 0 && Number.isInteger(MaxPoints) && MaxPoints > MinPoints
        && (Mode === 3 || (Number.isInteger(FloorAtPercent) && FloorAtPercent >= 1 && FloorAtPercent <= 100));
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
