import {z} from "zod";
import {analyticsRequest, periodQuery, type AnalyticsPeriod, wholeEvent} from "@/api/manageAnalytics";

// «Учасники» (§6.2) and «Комунікації» (§6.7): GET /events/{id}/manage/analytics/
// participants and communications. The period limits the registrations per day
// (participants) or the whole window (communications); open bounds by default.

const count = z.number().int();
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).nullish().transform(value => value ?? []);
const optionalNumber = z.number().nullish().transform(value => value ?? null);
const optionalTime = z.string().nullish().transform(value => value ?? null);

export const FunnelStageSchema = z.enum(["invited", "registered", "approved", "in_team", "attempted", "solved"]);
export type FunnelStage = z.infer<typeof FunnelStageSchema>;

const bucketSchema = z.object({Label: z.string(), Count: count});
export type AnalyticsBucket = z.infer<typeof bucketSchema>;

export const QuestionInputSchema = z.enum(["text", "long_text", "number", "select", "multi_select", "checkbox", "file", "date"]);
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

const questionSchema = z.object({
    Key: z.string(),
    Label: z.string(),
    // A future input type is shown as text bars rather than failing the page.
    Input: z.string().transform(value => QuestionInputSchema.safeParse(value).data ?? "text" as QuestionInput),
    Asked: count,
    Answered: count,
    Distinct: count.default(0),
    Buckets: list(bucketSchema),
    Min: optionalNumber,
    Max: optionalNumber,
    Avg: optionalNumber,
});
export type AnalyticsQuestion = z.infer<typeof questionSchema>;

export const AnalyticsParticipantsSchema = z.object({
    TeamMode: z.boolean(),
    Funnel: list(z.object({Stage: FunnelStageSchema, Count: count})),
    Registrations: z.object({
        Days: list(z.object({Day: z.string(), Open: count, Approval: count, Invitation: count})),
        Total: count,
    }),
    Teams: z.object({
        MinSize: count.default(0),
        MaxSize: count.default(0),
        Total: count.default(0),
        Histogram: list(z.object({Members: count, Teams: count})),
        Incomplete: list(z.object({ID: z.string(), Name: z.string(), Members: count, PendingInvitees: count})),
        PendingInvitees: count.default(0),
        WithoutTeam: count.default(0),
    }),
    Answers: z.object({Respondents: count, Questions: list(questionSchema)}),
    DropOff: z.object({
        Total: count,
        Rows: list(z.object({
            UserID: z.string(), Name: z.string(), Email: z.string(), TeamName: z.string(),
            RegisteredAt: z.string(), ApprovedAt: optionalTime, OpenedTasks: count,
        })),
    }),
    Period: z.object({From: optionalTime, To: optionalTime}),
});
export type AnalyticsParticipants = z.infer<typeof AnalyticsParticipantsSchema>;
export type AnalyticsDropOff = AnalyticsParticipants["DropOff"]["Rows"][number];
export type AnalyticsIncompleteTeam = AnalyticsParticipants["Teams"]["Incomplete"][number];

const commsTypeSchema = z.object({
    Type: z.string(),
    EmailSent: count, EmailErrors: count, InAppSent: count, InAppErrors: count, InAppCreated: count, InAppRead: count,
    ReadRate: optionalNumber,
});
export type AnalyticsCommsType = z.infer<typeof commsTypeSchema>;

export const AnalyticsCommunicationsSchema = z.object({
    Totals: commsTypeSchema,
    Types: list(commsTypeSchema),
    Forms: list(z.object({
        ID: z.string(), Title: z.string(), Registration: z.boolean(), Enabled: z.boolean(),
        Assigned: count, Completed: count, Answers: count, CompletionRate: optionalNumber,
    })),
    Period: z.object({From: optionalTime, To: optionalTime}),
});
export type AnalyticsCommunications = z.infer<typeof AnalyticsCommunicationsSchema>;
export type AnalyticsFormCompletion = AnalyticsCommunications["Forms"][number];

export const getAnalyticsParticipants = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `participants${periodQuery(period)}`, AnalyticsParticipantsSchema);
export const getAnalyticsCommunications = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `communications${periodQuery(period)}`, AnalyticsCommunicationsSchema);

export type ParticipantsTable = "funnel" | "registrations" | "teams" | "answers" | "dropoff";
export type CommunicationsTable = "types" | "forms";

// The API path of one table's CSV export, for downloadManageCSV.
export function analyticsTableExportPath(section: "participants" | "communications", table: ParticipantsTable | CommunicationsTable, period: AnalyticsPeriod = wholeEvent): string {
    const query = new URLSearchParams({table});
    if (period.from) query.set("from", period.from);
    if (period.to) query.set("to", period.to);
    return `analytics/${section}/export.csv?${query.toString()}`;
}
