import {z} from "zod";
import {analyticsRequest, periodQuery, wholeEvent, type AnalyticsPeriod} from "@/api/manageAnalytics";

// «Завдання» and «Прогрес» (docs/EVENT-ANALYTICS.md §6.3, §6.4):
// GET /events/{id}/manage/analytics/tasks/* and progress/*. Every report but
// the inactive teams takes the optional period `from`/`to`.

const count = z.number().int();
const rate = z.number();
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).nullish().transform(value => value ?? []);
const optionalTime = z.string().nullish().transform(value => value ?? null);
const optionalSeconds = z.number().int().nullish().transform(value => value ?? null);
const periodSchema = z.object({From: z.string(), To: z.string()});

// The all-zero UUID the API sends for a task outside every group.
export const noGroupID = "00000000-0000-0000-0000-000000000000";

export const CalibrationVerdictSchema = z.enum(["ok", "too_easy", "too_hard", "insufficient", "unknown"]);
export type CalibrationVerdict = z.infer<typeof CalibrationVerdictSchema>;

export const TaskRowSchema = z.object({
    ChallengeID: z.string(),
    Name: z.string(),
    Difficulty: z.string().default(""),
    Points: count,
    GroupID: z.string(),
    GroupName: z.string().default(""),
    Attempts: count,
    Correct: count,
    TeamsTried: count,
    TeamsOpened: count,
    Solves: count,
    SolveRate: rate,
    MedianSinceStartSeconds: optionalSeconds,
    MedianSinceOpenSeconds: optionalSeconds,
    FirstBloodTeam: z.string().default(""),
    FirstBloodAt: optionalTime,
    HintsOpened: count,
    HintPoints: count,
    Calibration: z.object({Verdict: CalibrationVerdictSchema, ExpectedMin: rate, ExpectedMax: rate}),
});
export type AnalyticsTaskRow = z.infer<typeof TaskRowSchema>;

const GroupRowSchema = z.object({
    GroupID: z.string(), GroupName: z.string().default(""), Tasks: count, Attempts: count, TeamsTried: count, Solves: count, SolveRate: rate,
});
export type AnalyticsGroupRow = z.infer<typeof GroupRowSchema>;

export const AnalyticsTasksSchema = z.object({Tasks: list(TaskRowSchema), Groups: list(GroupRowSchema), Period: periodSchema});
export type AnalyticsTasks = z.infer<typeof AnalyticsTasksSchema>;

const seriesPointSchema = z.object({At: z.string(), Attempts: count, Correct: count, Solves: count, Opens: count});
const hintGroupSchema = z.object({Teams: count, Solved: count, SolveRate: rate, MedianSeconds: optionalSeconds});
export type AnalyticsHintGroup = z.infer<typeof hintGroupSchema>;

export const AnalyticsTaskDetailSchema = z.object({
    Task: TaskRowSchema,
    Series: list(seriesPointSchema),
    FailedTeams: list(z.object({TeamID: z.string(), TeamName: z.string(), Attempts: count, LastAttemptAt: z.string(), HintsOpened: count})),
    HintEffect: z.object({With: hintGroupSchema, Without: hintGroupSchema}),
    Period: periodSchema,
    RefreshedAt: optionalTime,
    Final: z.boolean().default(false),
});
export type AnalyticsTaskDetail = z.infer<typeof AnalyticsTaskDetailSchema>;

export const AnalyticsWrongAnswersSchema = z.object({
    Answers: list(z.object({Answer: z.string(), Attempts: count, Teams: count, LastAt: z.string()})),
    Period: periodSchema,
});
export type AnalyticsWrongAnswers = z.infer<typeof AnalyticsWrongAnswersSchema>;

export const AnalyticsScoresSchema = z.object({
    Teams: list(z.object({TeamID: z.string(), Name: z.string(), Points: count, Solved: count, Rank: count, Hidden: z.boolean(), Admitted: z.boolean(), Selected: z.boolean()})),
    Series: list(z.object({TeamID: z.string(), Name: z.string(), Points: list(z.object({At: z.string(), Score: count}))})),
    Period: periodSchema,
});
export type AnalyticsScores = z.infer<typeof AnalyticsScoresSchema>;

const matrixTeamSchema = z.object({TeamID: z.string(), Name: z.string(), Points: count, Solved: count});
export type AnalyticsMatrixTeam = z.infer<typeof matrixTeamSchema>;

export const AnalyticsMatrixSchema = z.object({
    Tasks: list(z.object({ChallengeID: z.string(), Name: z.string(), GroupName: z.string().default("")})),
    Teams: list(matrixTeamSchema),
    Cells: list(z.object({TeamID: z.string(), ChallengeID: z.string(), Attempts: count, SolvedAt: optionalTime})),
    Period: periodSchema,
});
export type AnalyticsMatrix = z.infer<typeof AnalyticsMatrixSchema>;

export const AnalyticsHeatmapSchema = z.object({
    Hours: list(z.string()),
    Teams: list(matrixTeamSchema),
    Cells: list(z.object({TeamID: z.string(), HourAt: z.string(), Attempts: count, Opens: count, Solves: count, Activity: count})),
    MaxActivity: count,
    Period: periodSchema,
    RefreshedAt: optionalTime,
    Final: z.boolean().default(false),
});
export type AnalyticsHeatmap = z.infer<typeof AnalyticsHeatmapSchema>;

export const AnalyticsInactiveSchema = z.object({
    Minutes: count,
    AsOf: z.string(),
    Running: z.boolean(),
    Teams: list(z.object({TeamID: z.string(), Name: z.string(), LastActivityAt: optionalTime, IdleMinutes: count, Points: count})),
});
export type AnalyticsInactive = z.infer<typeof AnalyticsInactiveSchema>;

export const getAnalyticsTasks = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `tasks${periodQuery(period)}`, AnalyticsTasksSchema);
export const getAnalyticsTaskDetail = (eventID: string, challengeID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `tasks/${encodeURIComponent(challengeID)}${periodQuery(period)}`, AnalyticsTaskDetailSchema);
// Answer texts: only for the owner, write moderators and platform admins (a 403 otherwise).
export const getAnalyticsWrongAnswers = (eventID: string, challengeID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `tasks/${encodeURIComponent(challengeID)}/wrong-answers${periodQuery(period)}`, AnalyticsWrongAnswersSchema);

// `top` leading ranked teams plus the chosen ones.
export function scoresQuery(period: AnalyticsPeriod, top: number, teamIDs: string[]): string {
    const query = new URLSearchParams(periodQuery(period).replace(/^\?/, ""));
    query.set("top", String(top));
    if (teamIDs.length > 0) query.set("teams", teamIDs.join(","));
    return `?${query.toString()}`;
}
export const getAnalyticsScores = (eventID: string, period: AnalyticsPeriod, top: number, teamIDs: string[]) =>
    analyticsRequest(eventID, `progress/scores${scoresQuery(period, top, teamIDs)}`, AnalyticsScoresSchema);
export const getAnalyticsMatrix = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `progress/matrix${periodQuery(period)}`, AnalyticsMatrixSchema);
export const getAnalyticsHeatmap = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `progress/heatmap${periodQuery(period)}`, AnalyticsHeatmapSchema);
export const getAnalyticsInactive = (eventID: string, minutes: number) =>
    analyticsRequest(eventID, `progress/inactive?minutes=${minutes}`, AnalyticsInactiveSchema);

// The API path of the inactive teams' CSV, for downloadManageCSV.
export const inactiveExportPath = (minutes: number) => `analytics/progress/inactive/export.csv?minutes=${minutes}`;
