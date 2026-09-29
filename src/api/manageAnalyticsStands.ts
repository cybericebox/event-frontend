import {z} from "zod";
import {analyticsRequest, periodQuery, wholeEvent, type AnalyticsPeriod} from "@/api/manageAnalytics";

// «Стенди» (docs/EVENT-ANALYTICS.md §6.5): GET .../manage/analytics/stands.
// Durations are seconds; null means there is nothing to measure yet.

const count = z.number().int();
const seconds = z.number().int().nullish().transform(value => value ?? null);
const optionalTime = z.string().nullish().transform(value => value ?? null);

export const StandStatusSchema = z.enum(["not_deployed", "creating", "ready", "failed", "removed"]);
export type StandStatus = z.infer<typeof StandStatusSchema>;

const failureSchema = z.object({
    Source: z.enum(["stand", "lab"]),
    Task: z.string().default(""),
    At: z.string(),
    Reason: z.string().default(""),
    RecoveredAt: optionalTime,
    RecoverySeconds: seconds,
});
export type StandFailure = z.infer<typeof failureSchema>;

const teamSchema = z.object({
    TeamID: z.string(),
    TeamName: z.string(),
    Status: StandStatusSchema,
    Reason: z.string().default(""),
    StatusChangedAt: optionalTime,
    DeploySeconds: seconds,
    Generations: count,
    FailureCount: count,
    Unresolved: count,
    RecoveryAvgSeconds: seconds,
    RecoveryMaxSeconds: seconds,
    Failures: z.array(failureSchema).nullish().transform(value => value ?? []),
    // Sum of the team's devices' peaks over the period.
    Resources: z.object({Devices: count, PeakCPUMillicores: count, PeakMemoryBytes: count, Restarts: count, RestartedDevices: count}),
    VPN: z.object({Sessions: count, Users: count, Members: count, Seconds: count, RxBytes: count, TxBytes: count, LastAt: optionalTime}),
});
export type StandTeam = z.infer<typeof teamSchema>;

export const StandsSummarySchema = z.object({
    Teams: count, Ready: count, Creating: count, Failed: count, NotDeployed: count,
    DeployAvgSeconds: seconds, DeployMedianSeconds: seconds, DeployMaxSeconds: seconds,
    Failures: count, Unresolved: count, RecoveryAvgSeconds: seconds, RecoveryMaxSeconds: seconds,
    Restarts: count, VPNTeams: count, VPNSessions: count, VPNRxBytes: count, VPNTxBytes: count,
});
export type StandsSummary = z.infer<typeof StandsSummarySchema>;

export const AnalyticsStandsSchema = z.object({
    // false: the event has no infrastructure.
    Available: z.boolean(),
    Summary: StandsSummarySchema,
    Teams: z.array(teamSchema).nullish().transform(value => value ?? []),
    Period: z.object({From: z.string(), To: z.string()}),
});
export type AnalyticsStands = z.infer<typeof AnalyticsStandsSchema>;

export const getAnalyticsStands = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `stands${periodQuery(period)}`, AnalyticsStandsSchema);
