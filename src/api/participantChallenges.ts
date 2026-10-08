import {z} from "zod";
import {readApiErrorCode} from "@/api/apiErrors";
import {LabRuntimeSchema, type LabRuntime} from "@/api/manageLabs";
import {LabLifecycleSchema, revisionSchema, type LabLifecycle} from "@/api/labLifecycle";
import {t} from "@/i18n/t";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const attachmentSchema = z.object({file_id: id, name: z.string()});
// How much a hint helps; the event sets its price.
export const HINT_LEVELS = ["nudge", "direction", "steps", "near_solution"] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];
export const hintLevelSchema = z.enum(HINT_LEVELS).catch("nudge");
// Content arrives only once the team unlocked the hint (moderators see every text);
// it is a serialized rich-text document, or plain text from older exercises.
// Cost is what the team pays now, or what it paid. Level comes only on the
// moderators board; participants never receive it (default fills the gap).
export const hintSchema = z.object({
    ID: z.string(), Level: hintLevelSchema.default("nudge"), Cost: z.number().int().default(0), Unlocked: z.boolean().default(false),
    Content: z.string().nullish().transform(value => value ?? null),
    UnlockedAt: z.string().nullish().transform(value => value ?? null),
    UnlockedByName: z.string().nullish().transform(value => value ?? ""),
});
// A description placeholder as the exercise stores it (snake_case, like the rest of the snapshot).
export const placeholderSchema = z.object({
    key: z.string().default(""),
    kind: z.string(),
    ip_reference: z.string().optional(),
    octets_1to3: z.string().optional(),
    last_octet: z.number().int().optional(),
    show_mask: z.boolean().optional(),
    as_link: z.boolean().optional(),
    scheme: z.string().optional(),
    port: z.number().int().optional(),
    path: z.string().optional(),
    device_name: z.string().optional(),
});
export type SnapshotPlaceholder = z.infer<typeof placeholderSchema>;
const snapshotSchema = z.object({
    name: z.string(),
    description: z.unknown().optional(),
    difficulty: z.enum(["elementary", "trivial", "easy", "medium", "hard", "insane"]).catch("medium"),
    attachments: z.array(attachmentSchema).nullish().transform(value => value ?? []),
    placeholders: z.array(placeholderSchema).nullish().transform(value => value ?? []),
});
const fileSchema = z.object({FileID: id, Name: z.string(), Size: z.number().int().default(0)});
const prerequisiteSchema = z.object({EventChallengeID: id, Name: z.string(), Solved: z.boolean()});
export const challengeSchema = z.object({
    ID: id,
    EventChallengeID: id,
    // Every new question has its pinned attachment identity, including static ones.
    // Legacy absence remains unknown; a question ID cannot identify a shared Lab.
    EventExerciseID: id.nullish().transform(value => value ?? null),
    Lab: LabLifecycleSchema.nullish().transform(value => value ?? null),
    Snapshot: snapshotSchema,
    Readiness: z.number().int(),
    SolvedAt: z.string().nullable(),
    // Null while unsolved. AwardedPoints is what the solve earned after the hint penalty (0 for practice), SolvedBy who sent the answer.
    AwardedPoints: z.number().nullish().transform(value => value ?? null),
    HintPenalty: z.number().nullish().transform(value => value ?? null),
    SolvedBy: z.object({UserID: z.string(), Name: z.string()}).nullish().transform(value => value ?? null),
    Points: z.number().int(),
    Order: z.number().int(),
    GroupID: id.nullable(),
    GroupName: z.string(),
    GroupOrder: z.number().int(),
    ContentUpdatedAt: z.string().nullish().transform(value => value ?? null),
    Infrastructure: z.boolean().default(false),
    HintsEnabled: z.boolean().default(false),
    Locked: z.boolean().default(false),
    Prerequisites: z.array(prerequisiteSchema).nullish().transform(value => value ?? []),
    Files: z.array(fileSchema).nullish().transform(value => value ?? null),
    SolveCount: z.number().int().nullish().transform(value => value ?? null),
    Hints: z.array(hintSchema).nullish().transform(value => value ?? []),
    HintCostTotal: z.number().int().default(0),
    // The team's wrong submissions allowed on the task and what remains; null when unlimited or already solved.
    MaxAttempts: z.number().int().nullish().transform(value => value ?? null),
    AttemptsLeft: z.number().int().nullish().transform(value => value ?? null),
    // Moderators board only: the challenge is (not yet) on the participants' board.
    BoardPublished: z.boolean().optional(),
    // The stage of the task's set (null: the whole event). Closed: the stage closed and is not returnable (visible, no
    // submissions or hints). Practice: solved after a returnable stage closed, which the rating does not count.
    StageID: id.nullish().transform(value => value ?? null),
    Closed: z.boolean().default(false),
    Practice: z.boolean().default(false),
});
// Only opened stages are sent; an upcoming one never is.
const boardStageSchema = z.object({
    ID: id, Name: z.string(), OpensAt: z.string(), ClosesAt: z.string(), Returnable: z.boolean().default(false),
    State: z.enum(["open", "closed"]).catch("closed"),
});
// The stage that is open now. EndsAt is sent only while its countdown is visible (never for the last stage, which ends
// with the event); Last: the stage ends with the event.
const currentStageSchema = z.object({
    ID: id, Name: z.string(), OpensAt: z.string(),
    EndsAt: z.string().nullish().transform(value => value ?? null), Last: z.boolean().default(false),
});
const optionalTime = z.string().nullish().transform(value => value ?? null);
// The participant board: tasks plus the stage context. The clocks count against ServerNow; the board is refetched at NextChangeAt.
export const ownBoardSchema = z.object({
    Challenges: z.array(challengeSchema).nullish().transform(value => value ?? []),
    Stages: z.array(boardStageSchema).nullish().transform(value => value ?? []),
    ServerNow: z.string(),
    CurrentStage: currentStageSchema.nullish().transform(value => value ?? null),
    // The start of the next stage, only during a break.
    NextOpensAt: optionalTime,
    NextChangeAt: optionalTime,
});
const submissionSchema = z.object({
    Correct: z.boolean(), FirstSolve: z.boolean().default(false), Practice: z.boolean().default(false),
    Lab: LabLifecycleSchema.nullish().transform(value => value ?? null),
});
const solveSchema = z.object({TeamName: z.string(), NameHidden: z.boolean().optional(), SolvedAt: z.string(), Own: z.boolean(), FirstBlood: z.boolean().default(false)})
    .transform(row => row.NameHidden ? {...row, TeamName: t("scoreboard.nameHidden")} : row);
const solvesPageSchema = z.object({
    Total: z.number().int().default(0),
    Items: z.array(solveSchema).nullish().transform(value => value ?? []),
    NextCursor: id.nullish().transform(value => value ?? null),
});
export const SOLVES_PAGE_SIZE = 30;
export type OwnChallenge = z.infer<typeof challengeSchema>;
export type OwnBoard = z.infer<typeof ownBoardSchema>;
export type BoardStage = z.infer<typeof boardStageSchema>;
export type CurrentStage = z.infer<typeof currentStageSchema>;
export type ChallengeSubmission = z.infer<typeof submissionSchema>;
export type ChallengeSolve = z.infer<typeof solveSchema>;
export type ChallengeSolvesPage = z.infer<typeof solvesPageSchema>;
export type ChallengeFile = {FileID: string; Name: string; Size: number};
export type ChallengeHint = z.infer<typeof hintSchema>;

export class ParticipantChallengeError extends Error {
    constructor(readonly status: number, readonly code?: number, readonly retryAfter?: number) {
        super(`Participant challenge request failed: ${status}`);
    }
}

// Files with sizes; responses from before W3 carry only the snapshot names.
export function challengeFiles(challenge: OwnChallenge): ChallengeFile[] {
    return challenge.Files ?? challenge.Snapshot.attachments.map(file => ({FileID: file.file_id, Name: file.name, Size: 0}));
}

function baseUrl(eventID: string): string {
    const api = requireApiOrigin();
    return `${api}/api/events/${encodeURIComponent(eventID)}/teams/challenges`;
}

async function failure(response: Response): Promise<ParticipantChallengeError> {
    const retry = Number(response.headers.get("Retry-After"));
    return new ParticipantChallengeError(response.status, await readApiErrorCode(response), Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

export async function getOwnBoard(eventID: string): Promise<OwnBoard> {
    const response = await fetch(`${baseUrl(eventID)}/mine`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await failure(response);
    return z.object({Data: ownBoardSchema}).parse(await response.json()).Data;
}

// Who solved a challenge, oldest first (first blood on top), one cursor page at a
// time. The moderators board reads the organizer preview of the same list.
// Closed results answer 403 with the results-denied code.
export async function getChallengeSolves(eventID: string, challengeID: string, cursor: string | null = null, moderators = false): Promise<ChallengeSolvesPage> {
    const params = new URLSearchParams({pageSize: String(SOLVES_PAGE_SIZE)});
    if (cursor) params.set("cursor", cursor);
    const path = moderators
        ? `${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/labs/moderators/challenges/${encodeURIComponent(challengeID)}/solves`
        : `${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/solves`;
    const response = await fetch(`${path}?${params}`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await failure(response);
    return z.object({Data: solvesPageSchema}).parse(await response.json()).Data;
}

export async function submitChallenge(eventID: string, challengeID: string, answer: string, idempotencyKey: string): Promise<ChallengeSubmission> {
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/submit`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": idempotencyKey},
        body: JSON.stringify({Answer: answer}),
    });
    if (!response.ok) throw await failure(response);
    return z.object({Data: submissionSchema}).parse(await response.json()).Data;
}

export async function getOwnChallengeLab(eventID: string, challengeID: string): Promise<LabRuntime> {
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/lab`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await failure(response);
    return z.object({Data: LabRuntimeSchema}).parse(await response.json()).Data;
}

// The link that opens one web device of a task's lab: https://<device>-<code>.<base>/_auth?t=...
// It is short-lived and single use, so it is fetched on every click and never kept.
// The lab proxy turns it into its own cookie on the lab domain; the platform sets none.
// Staff testing tasks as the moderators team use the manage route.
export async function openLabLink(eventID: string, challengeID: string, device: string, port: number, moderators = false, expectedLab?: Pick<LabLifecycle, "ID" | "Revision">): Promise<{url: string; expiresAt: number; labID: string | null; revision: string | null}> {
    const path = moderators
        ? `${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/labs/moderators/challenges/${encodeURIComponent(challengeID)}`
        : `${baseUrl(eventID)}/${encodeURIComponent(challengeID)}`;
    const response = await fetch(`${path}/lab/link`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Device: device, Port: port}),
    });
    if (!response.ok) throw await failure(response);
    const schema = z.object({
        URL: z.string(), ExpiresAt: z.string(),
        LabID: id.nullish().transform(value => value ?? null),
        Revision: revisionSchema.nullish().transform(value => value ?? null),
    }).refine(data => !expectedLab || (data.LabID === expectedLab.ID && data.Revision === expectedLab.Revision));
    const data = z.object({Data: schema}).parse(await response.json()).Data;
    return {url: data.URL, expiresAt: new Date(data.ExpiresAt).getTime(), labID: data.LabID, revision: data.Revision};
}

// Idempotent per team: a repeat returns the first unlock. Cost is 0 once solved or finished.
export async function unlockChallengeHint(eventID: string, challengeID: string, hintID: string): Promise<ChallengeHint> {
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/hints/${encodeURIComponent(hintID)}/unlock`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await failure(response);
    return z.object({Data: hintSchema}).parse(await response.json()).Data;
}

export function challengeAttachmentUrl(eventID: string, challengeID: string, fileID: string): string {
    return `${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/files/${encodeURIComponent(fileID)}`;
}
