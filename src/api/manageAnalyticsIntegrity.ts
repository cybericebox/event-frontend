import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {analyticsRequest, type AnalyticsPeriod, wholeEvent} from "@/api/manageAnalytics";
import {requireApiOrigin} from "@/utils/origins";

// «Доброчесність» (docs/ANTI-CHEAT.md): GET .../manage/analytics/integrity.
// One list of flagged solves with the evidence of every signal. Hints for a
// person to review, never a verdict; no IP, no penalty. Sensitive: owner, write
// moderators and platform admins only.

const count = z.number().int();

// Strongest first: the order of the chips and of the counts.
export const integrityKinds = ["cross_flag", "no_access", "no_lab", "too_fast", "first_try_hard", "shared_wrong", "burst", "brute_force", "follows_solve"] as const;
export const IntegrityKindSchema = z.enum(integrityKinds);
export type IntegrityKind = z.infer<typeof IntegrityKindSchema>;

// Lowest first. An unknown level reads as medium, like the task board.
export const integrityLevels = ["elementary", "trivial", "easy", "medium", "hard", "insane"] as const;
export type IntegrityLevel = typeof integrityLevels[number];

const floorSchema = z.object({
    elementary: count.default(0), trivial: count.default(0), easy: count.default(0), medium: count.default(0), hard: count.default(0), insane: count.default(0),
});

const thresholdsSchema = z.object({
    FloorSeconds: floorSchema,
    BruteForceAttempts: count,
    BruteForceWindowSeconds: count,
    FollowGapSeconds: count,
});
export type IntegrityThresholds = z.infer<typeof thresholdsSchema>;

const teamRef = z.object({ID: z.string(), Name: z.string()});

// burst and cross_flag cannot be dismissed as a pattern.
export const dismissibleKinds: readonly IntegrityKind[] = ["shared_wrong", "no_access", "no_lab", "too_fast", "first_try_hard", "brute_force", "follows_solve"];
export const isDismissible = (kind: IntegrityKind) => dismissibleKinds.includes(kind);

const answerSchema = z.object({
    Value: z.string(),
    Order: z.array(z.object({TeamID: z.string(), TeamName: z.string(), At: z.string()})).nullish().transform(value => value ?? []),
});
export type IntegrityAnswer = z.infer<typeof answerSchema>;

const ownerSchema = z.object({TeamID: z.string(), TeamName: z.string(), ChallengeID: z.string(), ChallengeName: z.string(), SameTask: z.boolean().default(false)});

const signalSchema = z.object({
    Kind: IntegrityKindSchema,
    Count: count.nullish().transform(value => value ?? 0),
    Extra: count.nullish().transform(value => value ?? 0),
    Seconds: z.number().nullish().transform(value => value ?? 0),
    Baseline: z.number().nullish().transform(value => value ?? 0),
    Teams: z.array(teamRef).nullish().transform(value => value ?? []),
    // Low weight: shared_wrong on a task with a static flag.
    Info: z.boolean().nullish().transform(value => value ?? false),
    // shared_wrong: each shared wrong value with who sent it first, second, ...
    Answers: z.array(answerSchema).nullish().transform(value => value ?? []),
    // cross_flag: whose flag was submitted, and the last such submission.
    Owner: ownerSchema.nullish().transform(value => value ?? null),
    At: z.string().nullish().transform(value => value ?? null),
});
export type IntegritySignal = z.infer<typeof signalSchema>;

const reviewSchema = z.object({Note: z.string().default(""), ReviewedBy: z.string().default(""), ReviewedAt: z.string()});
export type IntegrityReview = z.infer<typeof reviewSchema>;

const itemSchema = z.object({
    TeamChallengeID: z.string(),
    TeamID: z.string(),
    TeamName: z.string(),
    ChallengeID: z.string(),
    ChallengeName: z.string(),
    Level: z.enum(integrityLevels).catch("medium"),
    // false: flagged before any solve (cross_flag); At is then the last
    // suspicious submission, otherwise the solve.
    Solved: z.boolean().default(true),
    At: z.string(),
    Signals: z.array(signalSchema).nullish().transform(value => value ?? []),
    Review: reviewSchema.nullish().transform(value => value ?? null),
});
export type IntegrityItem = z.infer<typeof itemSchema>;

const countsSchema = z.object(Object.fromEntries(integrityKinds.map(kind => [kind, count.default(0)])) as Record<IntegrityKind, z.ZodDefault<z.ZodNumber>>);
export type IntegrityCounts = z.infer<typeof countsSchema>;

export const AnalyticsIntegritySchema = z.object({
    Items: z.array(itemSchema).nullish().transform(value => value ?? []),
    // Total counts the flagged solves before the response cap.
    Total: count,
    // Per kind, honoring every filter except the signal filter.
    Counts: countsSchema.nullish().transform(value => value ?? countsSchema.parse({})),
    // The effective (clamped) values and the defaults.
    Thresholds: thresholdsSchema,
    Defaults: thresholdsSchema,
    Period: z.object({From: z.string(), To: z.string()}),
});
export type AnalyticsIntegrity = z.infer<typeof AnalyticsIntegritySchema>;

// The allowed range of every threshold; the server clamps the same way.
export const thresholdLimits = {
    floor: {min: 0, max: 3600},
    BruteForceAttempts: {min: 3, max: 1000},
    BruteForceWindowSeconds: {min: 10, max: 3600},
    FollowGapSeconds: {min: 5, max: 3600},
} as const;

function clampTo(value: number, limit: {min: number; max: number}): number {
    return Math.min(limit.max, Math.max(limit.min, Math.round(Number.isFinite(value) ? value : limit.min)));
}

export function clampThresholds(value: IntegrityThresholds): IntegrityThresholds {
    const floors = Object.fromEntries(integrityLevels.map(level => [level, clampTo(value.FloorSeconds[level], thresholdLimits.floor)])) as IntegrityThresholds["FloorSeconds"];
    return {
        FloorSeconds: floors,
        BruteForceAttempts: clampTo(value.BruteForceAttempts, thresholdLimits.BruteForceAttempts),
        BruteForceWindowSeconds: clampTo(value.BruteForceWindowSeconds, thresholdLimits.BruteForceWindowSeconds),
        FollowGapSeconds: clampTo(value.FollowGapSeconds, thresholdLimits.FollowGapSeconds),
    };
}

export function thresholdsEqual(a: IntegrityThresholds, b: IntegrityThresholds): boolean {
    return integrityLevels.every(level => a.FloorSeconds[level] === b.FloorSeconds[level])
        && a.BruteForceAttempts === b.BruteForceAttempts && a.BruteForceWindowSeconds === b.BruteForceWindowSeconds && a.FollowGapSeconds === b.FollowGapSeconds;
}

export type IntegrityReviewedFilter = "no" | "yes" | "all";

// `null` team / task / signal: no such filter.
export type IntegrityFilters = {signal: IntegrityKind | null; teamID: string | null; challengeID: string | null; reviewed: IntegrityReviewedFilter};
export const defaultIntegrityFilters: IntegrityFilters = {signal: null, teamID: null, challengeID: null, reviewed: "no"};

// `null` thresholds: the server defaults.
export function integrityQuery(period: AnalyticsPeriod, filters: IntegrityFilters, thresholds: IntegrityThresholds | null): string {
    const params = new URLSearchParams();
    if (period.from) params.set("from", period.from);
    if (period.to) params.set("to", period.to);
    if (filters.signal) params.set("signal", filters.signal);
    if (filters.teamID) params.set("teamId", filters.teamID);
    if (filters.challengeID) params.set("challengeId", filters.challengeID);
    if (filters.reviewed !== "all") params.set("reviewed", filters.reviewed);
    if (thresholds) {
        for (const level of integrityLevels) params.set(`floor${level[0].toUpperCase()}${level.slice(1)}`, String(thresholds.FloorSeconds[level]));
        params.set("bruteForceAttempts", String(thresholds.BruteForceAttempts));
        params.set("bruteForceWindow", String(thresholds.BruteForceWindowSeconds));
        params.set("followGap", String(thresholds.FollowGapSeconds));
    }
    const text = params.toString();
    return text ? `?${text}` : "";
}

export function getAnalyticsIntegrity(eventID: string, period: AnalyticsPeriod = wholeEvent, filters: IntegrityFilters = defaultIntegrityFilters, thresholds: IntegrityThresholds | null = null) {
    return analyticsRequest(eventID, `integrity${integrityQuery(period, filters, thresholds)}`, AnalyticsIntegritySchema);
}

// The CSV export path with the same period, filters and thresholds as the screen.
export const integrityExportPath = (period: AnalyticsPeriod, filters: IntegrityFilters, thresholds: IntegrityThresholds | null) =>
    `analytics/integrity/export.csv${integrityQuery(period, filters, thresholds)}`;

// The attempts journal (/manage/submissions) narrowed to the solve's team and task.
export function integrityJournalHref(solve: {TeamID: string; ChallengeID: string}): string {
    return `/manage/submissions?${new URLSearchParams({tab: "attempts", challengeId: solve.ChallengeID, teamId: solve.TeamID}).toString()}`;
}

// The integrity page narrowed to a team and a task (the journal marker links here).
export function integrityPageHref(solve: {TeamID: string; ChallengeID: string}): string {
    return `/manage/analytics/integrity?${new URLSearchParams({challengeId: solve.ChallengeID, teamId: solve.TeamID}).toString()}`;
}

async function reviewRequest(eventID: string, teamChallengeID: string, method: "PUT" | "DELETE", note?: string): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/analytics/integrity/solves/${encodeURIComponent(teamChallengeID)}/review`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(method === "PUT" ? {"Content-Type": "application/json"} : {})},
        body: method === "PUT" ? JSON.stringify({Note: note ?? ""}) : undefined,
    });
    if (!response.ok) throw await manageApiError(response);
}

export const maxReviewNoteLength = 1000;
export const putIntegrityReview = (eventID: string, teamChallengeID: string, note: string) => reviewRequest(eventID, teamChallengeID, "PUT", note);
export const deleteIntegrityReview = (eventID: string, teamChallengeID: string) => reviewRequest(eventID, teamChallengeID, "DELETE");

// Unreviewed flagged solves of the whole event, for the attempts journal.
const flagSchema = z.object({
    TeamChallengeID: z.string(),
    TeamID: z.string(),
    ChallengeID: z.string(),
    Count: count.default(0),
    Signals: z.array(z.string()).nullish().transform(value => value ?? []),
    // The submissions of another team's flag, to mark those attempts.
    CrossFlagTimes: z.array(z.string()).nullish().transform(value => value ?? []),
});
export type IntegrityFlag = z.infer<typeof flagSchema>;

export const getIntegrityFlags = (eventID: string) =>
    analyticsRequest(eventID, "integrity/flags", z.array(flagSchema).nullish().transform(value => value ?? []));

// Dismissed patterns ("do not highlight such cases"): for this event or for
// every event using the catalog exercise.
export type DismissScope = "event" | "exercise";
const dismissalSchema = z.object({
    ID: z.string(),
    Scope: z.enum(["event", "exercise"]),
    Kind: z.string(),
    Key: z.string().default(""),
    Note: z.string().default(""),
    ChallengeName: z.string().default(""),
    CreatedBy: z.string().default(""),
    CreatedAt: z.string(),
});
export type IntegrityDismissal = z.infer<typeof dismissalSchema>;

export const getIntegrityDismissals = (eventID: string) =>
    analyticsRequest(eventID, "integrity/dismissals", z.array(dismissalSchema).nullish().transform(value => value ?? []));

export type DismissInput = {TeamChallengeID: string; Kind: IntegrityKind; Key: string; Scope: DismissScope; Note: string};

async function dismissalRequest(eventID: string, method: "POST" | "DELETE", path: string, payload?: DismissInput): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/analytics/integrity/dismissals${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload ? {"Content-Type": "application/json"} : {})},
        body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) throw await manageApiError(response);
}

export const dismissIntegrityPattern = (eventID: string, input: DismissInput) => dismissalRequest(eventID, "POST", "", input);
export const removeIntegrityDismissal = (eventID: string, id: string) => dismissalRequest(eventID, "DELETE", `/${encodeURIComponent(id)}`);
