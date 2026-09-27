import {z} from "zod";
import {ManageApiError} from "@/api/manage";

const id = z.string().uuid();
const attemptSchema = z.object({
    ID: id, EventTeamID: id, TeamName: z.string(), TeamChallengeID: id, EventChallengeID: id,
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

let mockAttempts: ManageAttempt[] = [
    {ID: "01900000-0000-7000-8000-000000000021", EventTeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue Team", TeamChallengeID: "01900000-0000-7000-8000-000000000023", EventChallengeID: "01900000-0000-7000-8000-000000000011", EventExerciseID: "01900000-0000-7000-8000-000000000010", UserID: "01900000-0000-7000-8000-000000000024", ParticipantName: "Олена Коваль", Answer: "ICE{first_step}", ExpectedFlag: "ICE{first_step}", AutomaticCorrect: true, Decision: "automatic", DecisionReason: null, DecidedBy: null, DecidedAt: null, Correct: true, ReceivedAt: "2026-09-26T14:10:00Z"},
    {ID: "01900000-0000-7000-8000-000000000025", EventTeamID: "01900000-0000-7000-8000-000000000026", TeamName: "Red Team", TeamChallengeID: "01900000-0000-7000-8000-000000000027", EventChallengeID: "01900000-0000-7000-8000-000000000012", EventExerciseID: "01900000-0000-7000-8000-000000000010", UserID: "01900000-0000-7000-8000-000000000028", ParticipantName: "Іван Мельник", Answer: "ICE{almost}", ExpectedFlag: "ICE{final_step}", AutomaticCorrect: false, Decision: "automatic", DecisionReason: null, DecidedBy: null, DecidedAt: null, Correct: false, ReceivedAt: "2026-09-26T14:04:00Z"},
];

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (method === "GET") {
            const params = new URLSearchParams(path.split("?")[1] ?? "");
            const correct = params.get("correct");
            const cursor = params.get("cursor");
            const filtered = mockAttempts.filter(item => correct === null || item.Correct === (correct === "true"));
            const start = cursor ? Math.max(0, filtered.findIndex(item => item.ID === cursor) + 1) : 0;
            const pageSize = Number(params.get("pageSize") ?? 20);
            return schema.parse({Items: filtered.slice(start, start + pageSize), Total: filtered.length, NextCursor: filtered.length > start + pageSize ? filtered[start + pageSize - 1].ID : undefined});
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
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export function getManageAttempts(eventID: string, correct: boolean | null, cursor: string | null) {
    const params = new URLSearchParams({pageSize: "20"});
    if (correct !== null) params.set("correct", String(correct));
    if (cursor) params.set("cursor", cursor);
    return request(eventID, `solution-attempts?${params}`, pageSchema);
}

export function decideManageAttempt(eventID: string, attemptID: string, decision: AttemptDecision, reason: string) {
    return request(eventID, `solution-attempts/${encodeURIComponent(attemptID)}/decision`, decisionSchema, "PATCH", {Decision: decision, Reason: reason});
}
