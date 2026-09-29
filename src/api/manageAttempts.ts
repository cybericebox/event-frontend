import {z} from "zod";
import {ManageApiError, manageApiError} from "@/api/manage";
import {ApiErrorCode} from "@/api/apiErrors";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";

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

let mockAttempts: ManageAttempt[] = [
    {ID: "01900000-0000-7000-8000-000000000021", EventTeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue Team", TeamChallengeID: "01900000-0000-7000-8000-000000000023", EventChallengeID: "01900000-0000-7000-8000-000000000011", ChallengeName: "Перший крок", EventExerciseID: "01900000-0000-7000-8000-000000000010", UserID: "01900000-0000-7000-8000-000000000024", ParticipantName: "Олена Коваль", Answer: "ICE{first_step}", ExpectedFlag: "ICE{first_step}", AutomaticCorrect: true, Decision: "automatic", DecisionReason: null, DecidedBy: null, DecidedAt: null, Correct: true, ReceivedAt: "2026-09-26T14:10:00Z"},
    {ID: "01900000-0000-7000-8000-000000000060", EventTeamID: "01900000-0000-7000-8000-000000000040", TeamName: "Kyiv Hackers", TeamChallengeID: "01900000-0000-7000-8000-000000000061", EventChallengeID: "01900000-0000-7000-8000-000000000011", ChallengeName: "Перший крок", EventExerciseID: "01900000-0000-7000-8000-000000000010", UserID: "01900000-0000-7000-8000-000000000025", ParticipantName: "Андрій Бондар", Answer: "ICE{first_step}", ExpectedFlag: "ICE{first_step}", AutomaticCorrect: true, Decision: "automatic", DecisionReason: null, DecidedBy: null, DecidedAt: null, Correct: true, ReceivedAt: "2026-09-26T14:08:00Z"},
    {ID: "01900000-0000-7000-8000-000000000062", EventTeamID: "01900000-0000-7000-8000-000000000042", TeamName: "Null Pointers", TeamChallengeID: "01900000-0000-7000-8000-000000000063", EventChallengeID: "01900000-0000-7000-8000-000000000012", ChallengeName: "Фінальне завдання", EventExerciseID: "01900000-0000-7000-8000-000000000010", UserID: "01900000-0000-7000-8000-000000000031", ParticipantName: "Марія Сокол", Answer: "ice{final}", ExpectedFlag: "ICE{final_step}", AutomaticCorrect: false, Decision: "accepted", DecisionReason: "Регістр не важливий за правилами", DecidedBy: "01900000-0000-7000-8000-000000000029", DecidedAt: "2026-09-26T14:20:00Z", Correct: true, ReceivedAt: "2026-09-26T14:06:00Z"},
    {ID: "01900000-0000-7000-8000-000000000025", EventTeamID: "01900000-0000-7000-8000-000000000041", TeamName: "Red Team", TeamChallengeID: "01900000-0000-7000-8000-000000000027", EventChallengeID: "01900000-0000-7000-8000-000000000012", ChallengeName: "Фінальне завдання", EventExerciseID: "01900000-0000-7000-8000-000000000010", UserID: "01900000-0000-7000-8000-000000000028", ParticipantName: "Іван Мельник", Answer: "ICE{almost}", ExpectedFlag: "ICE{final_step}", AutomaticCorrect: false, Decision: "automatic", DecisionReason: null, DecidedBy: null, DecidedAt: null, Correct: false, ReceivedAt: "2026-09-26T14:04:00Z"},
];

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (method === "GET") {
            const params = new URLSearchParams(path.split("?")[1] ?? "");
            const correct = params.get("correct");
            const cursor = params.get("cursor");
            const from = params.get("from"), to = params.get("to");
            const filtered = mockAttempts.filter(item => (correct === null || item.Correct === (correct === "true"))
                && (!params.get("teamId") || item.EventTeamID === params.get("teamId")) && (!params.get("participantId") || item.UserID === params.get("participantId"))
                && (!params.get("challengeId") || item.EventChallengeID === params.get("challengeId"))
                && (!from || item.ReceivedAt >= from) && (!to || item.ReceivedAt < to));
            const start = cursor ? Math.max(0, filtered.findIndex(item => item.ID === cursor) + 1) : 0;
            const pageSize = Number(params.get("pageSize") ?? 20);
            return schema.parse({Items: filtered.slice(start, start + pageSize), Total: filtered.length, NextCursor: filtered.length > start + pageSize ? filtered[start + pageSize - 1].ID : undefined});
        }
        if (path === "solution-attempts/annul") {
            const input = payload as {TeamID: string; ChallengeID: string; Reason: string};
            const accepted = mockAttempts.filter(item => item.EventTeamID === input.TeamID && item.EventChallengeID === input.ChallengeID && item.Correct);
            if (!accepted.length) throw new ManageApiError(409, ApiErrorCode.NothingToAnnul);
            const decidedAt = new Date().toISOString();
            mockAttempts = mockAttempts.map(item => accepted.includes(item) ? {...item, Decision: "rejected", DecisionReason: input.Reason, DecidedAt: decidedAt, DecidedBy: "01900000-0000-7000-8000-000000000029", Correct: false} : item);
            return schema.parse({TeamID: input.TeamID, ChallengeID: input.ChallengeID, Rejected: accepted.length});
        }
        const attemptID = path.split("/")[1];
        const input = payload as {Decision: AttemptDecision; Reason: string};
        const attempt = mockAttempts.find(item => item.ID === attemptID);
        if (!attempt || !input.Reason.trim()) throw new ManageApiError(400);
        const correct = input.Decision === "accepted" || (input.Decision === "automatic" && attempt.AutomaticCorrect);
        const decidedAt = new Date().toISOString();
        const decidedBy = "01900000-0000-7000-8000-000000000029";
        mockAttempts = mockAttempts.map(item => item.ID === attemptID ? {...item, Decision: input.Decision, DecisionReason: input.Reason, DecidedAt: decidedAt, DecidedBy: decidedBy, Correct: correct} : item);
        return schema.parse({AttemptID: attemptID, Decision: input.Decision, Reason: input.Reason, DecidedAt: decidedAt, DecidedBy: decidedBy, Correct: correct});
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
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
    return downloadManageCSV(eventID, `solution-attempts/export.csv${query ? `?${query}` : ""}`, csvFileName("attempts"), [
        ["Час (UTC)", "Завдання", "Команда", "Учасник", "Відповідь", "Автоперевірка", "Рішення", "Зараховано", "Причина рішення"],
        ...mockAttempts.map(item => [item.ReceivedAt, item.ChallengeName, item.TeamName, item.ParticipantName, item.Answer, item.AutomaticCorrect ? "так" : "ні", item.Decision, item.Correct ? "так" : "ні", item.DecisionReason ?? ""]),
    ]);
}

// SSE: «attempts-changed» whenever attempts or decisions of the event change.
export function attemptsLiveURL(eventID: string): string | null {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    return domain ? `https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/solution-attempts/live` : null;
}

export function decideManageAttempt(eventID: string, attemptID: string, decision: AttemptDecision, reason: string) {
    return request(eventID, `solution-attempts/${encodeURIComponent(attemptID)}/decision`, decisionSchema, "PATCH", {Decision: decision, Reason: reason});
}
