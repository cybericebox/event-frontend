import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";

// Event analytics (docs/EVENT-ANALYTICS.md): GET /events/{id}/manage/analytics/*.
// Every report takes the optional period `from`/`to` (RFC 3339); without one the
// server uses the event's own window.

export type AnalyticsPeriod = {from: string | null; to: string | null};
export const wholeEvent: AnalyticsPeriod = {from: null, to: null};

const count = z.number().int();
const optionalTime = z.string().nullish().transform(value => value ?? null);

export const AnalyticsAccessSchema = z.object({Sections: z.boolean(), Sensitive: z.boolean().default(false)});
export type AnalyticsAccess = z.infer<typeof AnalyticsAccessSchema>;

export const FeedKindSchema = z.enum(["first_blood", "stand_failed", "team_created", "freeze_started"]);
export type FeedKind = z.infer<typeof FeedKindSchema>;

const feedItemSchema = z.object({
    Kind: FeedKindSchema,
    At: z.string(),
    TeamID: z.string().nullish().transform(value => value ?? null),
    TeamName: z.string().default(""),
    ChallengeName: z.string().default(""),
    Detail: z.string().default(""),
});
export type AnalyticsFeedItem = z.infer<typeof feedItemSchema>;

const seriesPointSchema = z.object({At: z.string(), Attempts: count, Correct: count, Solves: count, Opens: count});
export type AnalyticsSeriesPoint = z.infer<typeof seriesPointSchema>;

const leaderSchema = z.object({TeamID: z.string(), Name: z.string(), Rank: count, Points: count, Solved: count, Gap: count});
export type AnalyticsLeader = z.infer<typeof leaderSchema>;

const taskSolvesSchema = z.object({ChallengeID: z.string(), Name: z.string(), Solves: count}).nullish().transform(value => value ?? null);

const tasksSnapshotSchema = z.object({Total: count, Unsolved: count, FirstBloods: count, MostSolved: taskSolvesSchema, LeastSolved: taskSolvesSchema});
const engagementSchema = z.object({Teams: count, TeamsSolving: count, AvgSolves: z.number()});
// Mail of the last 24 hours; null unless the viewer has the sensitive access.
const commsSnapshotSchema = z.object({EmailSent: count, EmailFailed: count, Since: z.string()}).nullish().transform(value => value ?? null);

export const AnalyticsOverviewSchema = z.object({
    Participants: z.object({Registered: count, Approved: count, Pending: count, Invited: count, Active: count}),
    Teams: z.object({Total: count, Admitted: count, Incomplete: count}),
    Attempts: count,
    Correct: count,
    Solves: count,
    HintsOpened: count,
    HintPoints: count,
    Stands: z.object({Creating: count, Ready: count, Failed: count}),
    Series: z.array(seriesPointSchema).nullish().transform(value => value ?? []),
    Feed: z.array(feedItemSchema).nullish().transform(value => value ?? []),
    Markers: z.object({StartAt: z.string(), FreezeAt: optionalTime, FinishAt: optionalTime}),
    Period: z.object({From: z.string(), To: z.string()}),
    RefreshedAt: optionalTime,
    Final: z.boolean().default(false),
    Leaders: z.array(leaderSchema).nullish().transform(value => value ?? []),
    RankedTeams: count.default(0),
    Tasks: tasksSnapshotSchema.default({Total: 0, Unsolved: 0, FirstBloods: 0, MostSolved: null, LeastSolved: null}),
    Engagement: engagementSchema.default({Teams: 0, TeamsSolving: 0, AvgSolves: 0}),
    Comms: commsSnapshotSchema,
});
export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>;

// `?from=…&to=…` for a period, "" for the whole event.
export function periodQuery(period: AnalyticsPeriod): string {
    const query = new URLSearchParams();
    if (period.from) query.set("from", period.from);
    if (period.to) query.set("to", period.to);
    const text = query.toString();
    return text ? `?${text}` : "";
}

export async function analyticsRequest<T>(eventID: string, path: string, schema: z.ZodType<T>): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/analytics/${path}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export const getAnalyticsAccess = (eventID: string) => analyticsRequest(eventID, "access", AnalyticsAccessSchema);
export const getAnalyticsOverview = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `overview${periodQuery(period)}`, AnalyticsOverviewSchema);

// The API path of a section's CSV export, for downloadManageCSV
// (`analytics/<section>/export.csv` with the same period).
export const analyticsExportPath = (section: string, period: AnalyticsPeriod = wholeEvent) =>
    `analytics/${section}/export.csv${periodQuery(period)}`;
