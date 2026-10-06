import {z} from "zod";
import {analyticsRequest} from "@/api/manageAnalytics";

// «Звіт по заході» (docs/EVENT-ANALYTICS.md §6.8): GET .../manage/analytics/report
// and .../report/export.zip. Available only after the finish.

const count = z.number().int();
const optionalTime = z.string().nullish().transform(value => value ?? null);

export const FunnelStepSchema = z.object({Key: z.string(), Count: count});
export type FunnelStep = z.infer<typeof FunnelStepSchema>;

const rankSchema = z.object({
    Rank: count, TeamID: z.string(), Name: z.string(), Individual: z.boolean(), Members: count,
    Points: count, Solved: count, Attempts: count, LastSolveAt: optionalTime,
});
export type ReportRank = z.infer<typeof rankSchema>;

const taskSchema = z.object({
    ChallengeID: z.string(), Name: z.string(), Points: count, TeamsOpened: count, TeamsAttempted: count,
    Attempts: count, CorrectAttempts: count, Solves: count, SolveRate: z.number(), HintsUnlocked: count,
    FirstSolveAt: optionalTime, FirstSolveTeam: z.string().default(""),
});
export type ReportTask = z.infer<typeof taskSchema>;

export const AnalyticsReportSchema = z.object({
    // false before the finish; then only EventName, StartAt and FinishAt are set.
    Available: z.boolean(),
    EventName: z.string().default(""),
    StartAt: z.string(),
    FinishAt: optionalTime,
    GeneratedAt: z.string(),
    Participants: z.object({Registered: count, Approved: count, Pending: count, Invited: count, Active: count}),
    Teams: z.object({Total: count, Admitted: count, Incomplete: count}),
    Tasks: count, Attempts: count, Correct: count, Solves: count, HintsOpened: count, HintPoints: count,
    Ranking: z.array(rankSchema).nullish().transform(value => value ?? []),
    TaskRows: z.array(taskSchema).nullish().transform(value => value ?? []),
    ParticipantFunnel: z.array(FunnelStepSchema).nullish().transform(value => value ?? []),
    TeamFunnel: z.array(FunnelStepSchema).nullish().transform(value => value ?? []),
    Series: z.array(z.object({At: z.string(), Attempts: count, Correct: count, Solves: count, Opens: count})).nullish().transform(value => value ?? []),
    Stands: z.object({
        Teams: count, Ready: count, Failed: count, Failures: count, Unresolved: count,
        DeployAvgSeconds: z.number().int().nullish().transform(value => value ?? null),
    }).passthrough().nullish().transform(value => value ?? null),
});
export type AnalyticsReport = z.infer<typeof AnalyticsReportSchema>;

export const getAnalyticsReport = (eventID: string) => analyticsRequest(eventID, "report", AnalyticsReportSchema);

export const REPORT_BUNDLE_PATH = "analytics/report/export.zip";

export function reportFileName(at: Date = new Date()): string {
    return `analytics-report-${at.toISOString().slice(0, 10)}.zip`;
}
