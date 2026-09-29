import {z} from "zod";
import {ManageApiError, manageApiError} from "@/api/manage";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";
import {apiOrigin, requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const attemptSchema = z.object({
    ID: id, EventTeamID: id, TeamName: z.string(), TeamChallengeID: id, EventChallengeID: id, ChallengeName: z.string(),
    EventExerciseID: id, UserID: id, ParticipantName: z.string(), Answer: z.string(),
    ExpectedFlag: z.string(), AutomaticCorrect: z.boolean(), Decision: z.enum(["automatic", "accepted", "rejected"]),
    DecisionReason: z.string().nullable(), DecidedBy: id.nullable(), DecidedAt: z.string().nullable(),
    Correct: z.boolean(), ReceivedAt: z.string(),
});
const pageSchema = z.object({Items: z.array(attemptSchema), Total: z.number().int(), NextCursor: id.optional()});
const decisionSchema = z.object({AttemptID: id, Decision: z.enum(["automatic", "accepted", "rejected"]), Reason: z.string(), DecidedBy: id, DecidedAt: z.string(), Correct: z.boolean()});

export type ManageAttempt = z.infer<typeof attemptSchema>;
export type ManageAttemptsPage = z.infer<typeof pageSchema>;
export type AttemptDecision = ManageAttempt["Decision"];

// Filters of the «Спроби» page. Period bounds are datetime-local values read
// as UTC (the page shows UTC times); "" means no bound.
export type AttemptFilters = {teamID: string | null; participantID: string | null; challengeID: string | null; correct: boolean | null; from: string; to: string};
export const emptyAttemptFilters: AttemptFilters = {teamID: null, participantID: null, challengeID: null, correct: null, from: "", to: ""};

export function utcBound(value: string): string | null {
    if (!value) return null;
    const withSeconds = value.length === 16 ? `${value}:00` : value;
    return Number.isNaN(Date.parse(`${withSeconds}Z`)) ? null : `${withSeconds}Z`;
}

export function attemptQueryParams(filters: AttemptFilters, cursor: string | null = null, pageSize: number | null = 20): URLSearchParams {
    const params = new URLSearchParams();
    if (pageSize !== null) params.set("pageSize", String(pageSize));
    if (filters.teamID) params.set("teamId", filters.teamID);
    if (filters.participantID) params.set("participantId", filters.participantID);
    if (filters.challengeID) params.set("challengeId", filters.challengeID);
    if (filters.correct !== null) params.set("correct", String(filters.correct));
    const from = utcBound(filters.from), to = utcBound(filters.to);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (cursor) params.set("cursor", cursor);
    return params;
}

// 400 code 21929: the paging cursor no longer exists; start from the first page.
export class AttemptsCursorError extends ManageApiError {
    constructor() {
        super(400);
    }
}

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (response.status === 400) {
        const body = z.object({Status: z.object({Code: z.number()})}).safeParse(await response.json().catch(() => null));
        throw body.success && body.data.Status.Code === 21929 ? new AttemptsCursorError() : new ManageApiError(400);
    }
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export function getManageAttempts(eventID: string, filters: AttemptFilters, cursor: string | null) {
    return request(eventID, `solution-attempts?${attemptQueryParams(filters, cursor)}`, pageSchema);
}

// «Анулювати розвʼязок»: rejects every accepted attempt of the team+challenge
// pair at once. 409 NothingToAnnul when the pair has no accepted attempt.
export function annulManageSolve(eventID: string, teamID: string, challengeID: string, reason: string) {
    return request(eventID, "solution-attempts/annul", z.object({TeamID: id, ChallengeID: id, Rejected: z.number().int()}), "POST", {TeamID: teamID, ChallengeID: challengeID, Reason: reason});
}

export function downloadAttemptsCSV(eventID: string, filters: AttemptFilters) {
    const query = attemptQueryParams(filters, null, null).toString();
    return downloadManageCSV(eventID, `solution-attempts/export.csv${query ? `?${query}` : ""}`, csvFileName("attempts"));
}

// SSE: «attempts-changed» whenever attempts or decisions of the event change.
export function attemptsLiveURL(eventID: string): string | null {
    return apiOrigin ? `${apiOrigin}/api/events/${encodeURIComponent(eventID)}/manage/solution-attempts/live` : null;
}

export function decideManageAttempt(eventID: string, attemptID: string, decision: AttemptDecision, reason: string) {
    return request(eventID, `solution-attempts/${encodeURIComponent(attemptID)}/decision`, decisionSchema, "PATCH", {Decision: decision, Reason: reason});
}
