import {z} from "zod";
import {analyticsExportPath, analyticsRequest, wholeEvent, type AnalyticsPeriod} from "@/api/manageAnalytics";

// «Доброчесність» (docs/EVENT-ANALYTICS.md §6.6): GET .../manage/analytics/integrity.
// Signals to review, from timing, answer similarity and attempt patterns. No IP,
// no penalty. Sensitive: owner, write moderators and platform admins only.

const count = z.number().int();

export const IntegrityKindSchema = z.enum(["same_answer", "burst", "fast_solve"]);
export type IntegrityKind = z.infer<typeof IntegrityKindSchema>;

const thresholdsSchema = z.object({
    SameAnswerWindowSeconds: count, SameAnswerMinLength: count, IncludeCorrect: z.boolean(),
    BurstAttempts: count, BurstWindowSeconds: count, FastSolveGapSeconds: count,
});
export type IntegrityThresholds = z.infer<typeof thresholdsSchema>;

const signalSchema = z.object({
    Kind: IntegrityKindSchema,
    ChallengeID: z.string(),
    ChallengeName: z.string(),
    Teams: z.array(z.object({ID: z.string(), Name: z.string()})).nullish().transform(value => value ?? []),
    From: z.string(),
    To: z.string(),
    Answer: z.string().default(""),
    Correct: z.boolean().default(false),
    Attempts: count,
    Rejections: count,
    GapSeconds: count,
});
export type IntegritySignal = z.infer<typeof signalSchema>;

export const AnalyticsIntegritySchema = z.object({
    Signals: z.array(signalSchema).nullish().transform(value => value ?? []),
    // Total counts the signals before the response cap.
    Total: count, SameAnswer: count, Burst: count, FastSolve: count,
    // The effective (clamped) values and the defaults.
    Thresholds: thresholdsSchema,
    Defaults: thresholdsSchema,
    Period: z.object({From: z.string(), To: z.string()}),
});
export type AnalyticsIntegrity = z.infer<typeof AnalyticsIntegritySchema>;

// The allowed range of every threshold, matching the server's clamping.
export const thresholdLimits = {
    SameAnswerWindowSeconds: {min: 10, max: 3600},
    SameAnswerMinLength: {min: 1, max: 100},
    BurstAttempts: {min: 3, max: 1000},
    BurstWindowSeconds: {min: 10, max: 3600},
    FastSolveGapSeconds: {min: 5, max: 3600},
} as const;

export function clampThresholds(value: IntegrityThresholds): IntegrityThresholds {
    const clamp = (n: number, key: keyof typeof thresholdLimits) => Math.min(thresholdLimits[key].max, Math.max(thresholdLimits[key].min, Math.round(Number.isFinite(n) ? n : thresholdLimits[key].min)));
    return {
        ...value,
        SameAnswerWindowSeconds: clamp(value.SameAnswerWindowSeconds, "SameAnswerWindowSeconds"),
        SameAnswerMinLength: clamp(value.SameAnswerMinLength, "SameAnswerMinLength"),
        BurstAttempts: clamp(value.BurstAttempts, "BurstAttempts"),
        BurstWindowSeconds: clamp(value.BurstWindowSeconds, "BurstWindowSeconds"),
        FastSolveGapSeconds: clamp(value.FastSolveGapSeconds, "FastSolveGapSeconds"),
    };
}

export function thresholdsEqual(a: IntegrityThresholds, b: IntegrityThresholds): boolean {
    return a.SameAnswerWindowSeconds === b.SameAnswerWindowSeconds && a.SameAnswerMinLength === b.SameAnswerMinLength && a.IncludeCorrect === b.IncludeCorrect
        && a.BurstAttempts === b.BurstAttempts && a.BurstWindowSeconds === b.BurstWindowSeconds && a.FastSolveGapSeconds === b.FastSolveGapSeconds;
}

// `null` thresholds: the server defaults.
function thresholdParams(period: AnalyticsPeriod, thresholds: IntegrityThresholds | null): URLSearchParams {
    const params = new URLSearchParams();
    if (period.from) params.set("from", period.from);
    if (period.to) params.set("to", period.to);
    if (thresholds) {
        params.set("sameAnswerWindow", String(thresholds.SameAnswerWindowSeconds));
        params.set("sameAnswerMinLength", String(thresholds.SameAnswerMinLength));
        params.set("includeCorrect", String(thresholds.IncludeCorrect));
        params.set("burstAttempts", String(thresholds.BurstAttempts));
        params.set("burstWindow", String(thresholds.BurstWindowSeconds));
        params.set("fastSolveGap", String(thresholds.FastSolveGapSeconds));
    }
    return params;
}

export function getAnalyticsIntegrity(eventID: string, period: AnalyticsPeriod = wholeEvent, thresholds: IntegrityThresholds | null = null) {
    const query = thresholdParams(period, thresholds).toString();
    return analyticsRequest(eventID, `integrity${query ? `?${query}` : ""}`, AnalyticsIntegritySchema);
}

// The CSV export path with the same period and thresholds as the screen.
export function integrityExportPath(period: AnalyticsPeriod, thresholds: IntegrityThresholds | null): string {
    const query = thresholdParams(period, thresholds).toString();
    return `${analyticsExportPath("integrity")}${query ? `?${query}` : ""}`;
}

// The attempts journal (/manage/submissions) narrowed to a signal: its task and
// the span it is made of, widened by a minute each way. A single-team signal
// (a burst) also narrows to the team.
export function integrityJournalHref(signal: IntegritySignal): string {
    const params = new URLSearchParams({tab: "attempts", challengeId: signal.ChallengeID});
    if (signal.Kind === "burst" && signal.Teams.length === 1) params.set("teamId", signal.Teams[0].ID);
    const minute = 60_000;
    params.set("from", new Date(Date.parse(signal.From) - minute).toISOString());
    params.set("to", new Date(Date.parse(signal.To) + minute).toISOString());
    return `/manage/submissions?${params.toString()}`;
}
