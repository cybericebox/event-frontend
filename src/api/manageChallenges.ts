import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const scoringOverrideSchema = z.object({
    Mode: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    MinPoints: z.number().int(), MaxPoints: z.number().int(), FloorAtPercent: z.number().int(),
});
const forkSchema = z.object({
    SourceExerciseID: id, SourceExerciseName: z.string(),
    SourceVersionID: id.nullable(), SourceVersionNumber: z.number().int(),
    SourceLatestVersionID: id.nullable(), SourceLatestVersionNumber: z.number().int(),
    SourceUpdateAvailable: z.boolean(),
});
// Status: 0 active, 1 superseded (legacy revisions), 2 detached.
const attachmentSchema = z.object({
    ID: id, ExerciseID: id, ExerciseName: z.string(), ExerciseVersionID: id, VariantMode: z.number().int(),
    FixedVariantIndex: z.number().int().nullable(), Revision: z.number().int(),
    Status: z.number().int(), ReplacesID: id.nullish().transform(value => value ?? null),
    SupersededAt: z.string().nullish().transform(value => value ?? null),
    DetachedAt: z.string().nullish().transform(value => value ?? null), CreatedAt: z.string(),
    Scope: z.enum(["catalog", "event"]).catch("catalog"),
    // Catalog version ordinal: the «версія N» label (Revision is the event's own counter).
    VersionNumber: z.number().int().default(0),
    LatestVersionID: id.nullish().transform(value => value ?? null),
    LatestVersionNumber: z.number().int().default(0),
    UpdateAvailable: z.boolean().default(false),
    Fork: forkSchema.nullish().transform(value => value ?? null),
    Infrastructure: z.boolean().default(false),
    VariantCount: z.number().int().default(1),
    ChallengeCount: z.number().int().default(0),
    PublishedCount: z.number().int().default(0),
    HasAttempts: z.boolean().default(false),
});
const challengeHintSchema = z.object({ID: id, Text: z.string(), DefaultCost: z.number().int(), Cost: z.number().int(), Overridden: z.boolean()});
const challengeSchema = z.object({
    ID: id, TaskID: id, GroupID: id.nullable(), PrerequisiteIDs: z.array(id).nullable().transform(value => value ?? []),
    Order: z.number().int(), Points: z.number().int(), ScoringOverride: scoringOverrideSchema.nullable(), HintsEnabled: z.boolean(), Published: z.boolean(),
    Snapshot: z.object({name: z.string()}),
    Hints: z.array(challengeHintSchema).nullish().transform(value => value ?? []),
});
const groupSchema = z.object({ID: id, Name: z.string(), Order: z.number().int(), CreatedAt: z.string()});
const catalogChoiceSchema = z.object({
    ID: id, Name: z.string(), Description: z.string(), PublishedVersionID: id,
    Tags: z.array(z.string()).nullish().transform(value => value ?? []),
    Scope: z.enum(["catalog", "event"]).catch("catalog"),
    Infrastructure: z.boolean().default(false),
    Attached: z.boolean().default(false),
});
const catalogPreviewSchema = z.object({
    ID: id, Name: z.string(), Description: z.string(), VersionID: id, VariantCount: z.number().int(), Variant: z.number().int().default(0),
    Tasks: z.array(z.object({Name: z.string(), Difficulty: z.string(), HintCount: z.number().int().default(0)})),
});
const hintUnlockSchema = z.object({
    TeamID: id, TeamName: z.string(), EventChallengeID: id, ChallengeName: z.string(), HintID: id,
    HintIndex: z.number().int(), UnlockedBy: id.nullable(), UnlockedByName: z.string(), UnlockedAt: z.string(), Cost: z.number().int(),
});

export type EventExerciseAttachment = z.infer<typeof attachmentSchema>;
export type EventBoardChallenge = z.infer<typeof challengeSchema>;
export type EventChallengeHint = z.infer<typeof challengeHintSchema>;
export type EventChallengeGroup = z.infer<typeof groupSchema>;
export type PublishedExerciseChoice = z.infer<typeof catalogChoiceSchema>;
export type PublishedExercisePreview = z.infer<typeof catalogPreviewSchema>;
export type ChallengeScoringOverride = z.infer<typeof scoringOverrideSchema>;
export type HintUnlock = z.infer<typeof hintUnlockSchema>;
export type InfrastructureFilter = "all" | "yes" | "no";
export type HintCostInput = {HintID: string; Cost: number | null};
export {attachmentSchema as EventExerciseAttachmentSchema, catalogChoiceSchema as PublishedExerciseChoiceSchema, hintUnlockSchema as HintUnlockSchema};

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

const catalogQuery = (search: string, infrastructure: InfrastructureFilter) => {
    const query = new URLSearchParams({search});
    if (infrastructure !== "all") query.set("infrastructure", infrastructure);
    return query.toString();
};

export const getEventChallengeGroups = (eventID: string) => request(eventID, "challenge-groups", z.array(groupSchema));
export const createEventChallengeGroup = (eventID: string, Name: string, Order: number) => request(eventID, "challenge-groups", groupSchema, "POST", {Name, Order});
export const updateEventChallengeGroup = (eventID: string, groupID: string, Name: string, Order: number) => request(eventID, `challenge-groups/${groupID}`, groupSchema, "PUT", {Name, Order});
// Full ordered list of every group ID; the server reorders in one transaction.
export const reorderEventChallengeGroups = (eventID: string, groupIDs: string[]) => request(eventID, "challenge-groups/order", z.null(), "PUT", {GroupIDs: groupIDs});
export const deleteEventChallengeGroup = (eventID: string, groupID: string) => request(eventID, `challenge-groups/${groupID}`, z.null(), "DELETE");
export const getEventExerciseAttachments = (eventID: string) => request(eventID, "exercises", z.array(attachmentSchema));
export const getEventBoardChallenges = (eventID: string, attachmentID: string) => request(eventID, `exercises/${attachmentID}/challenges`, z.array(challengeSchema));
export const setEventChallengeGroup = (eventID: string, attachmentID: string, challenge: EventBoardChallenge, groupID: string | null) => request(eventID, `exercises/${attachmentID}/challenges/${challenge.ID}/relations`, z.null(), "PUT", {GroupID: groupID, PrerequisiteIDs: challenge.PrerequisiteIDs});
export const reorderEventBoardChallenges = (eventID: string, attachmentID: string, challengeIDs: string[]) => request(eventID, `exercises/${attachmentID}/challenges/order`, z.null(), "PUT", {ChallengeIDs: challengeIDs});
// Own event exercises first, then the catalog ones available to the event.
export const getPublishedExerciseChoices = (eventID: string, search: string, infrastructure: InfrastructureFilter = "all") => request(eventID, `exercise-catalog?${catalogQuery(search, infrastructure)}`, z.array(catalogChoiceSchema));
export const getPublishedExercisePreview = (eventID: string, versionID: string, variant = 0) => request(eventID, `exercise-catalog/${encodeURIComponent(versionID)}?variant=${variant}`, catalogPreviewSchema);
export const attachEventExercise = (eventID: string, versionID: string, variantMode: 0 | 1, fixedVariantIndex: number | null) => request(eventID, "exercises", attachmentSchema, "POST", {ExerciseVersionID: versionID, VariantMode: variantMode, FixedVariantIndex: fixedVariantIndex});
// «Оновити»: the latest published version; event settings carry over (409 1809 when a removed task has attempts).
export const updateEventExercise = (eventID: string, attachmentID: string, versionID?: string) => request(eventID, `exercises/${attachmentID}/update`, attachmentSchema, "POST", versionID ? {ExerciseVersionID: versionID} : {});
// «Налаштувати під подію»: the attachment switches to the event's own copy.
export const forkEventExercise = (eventID: string, attachmentID: string) => request(eventID, `exercises/${attachmentID}/fork`, attachmentSchema, "POST");
// «Повернути оригінал»: back to the catalog version the copy was made from.
export const revertEventExercise = (eventID: string, attachmentID: string) => request(eventID, `exercises/${attachmentID}/revert`, attachmentSchema, "POST");
// With attempts the server wants confirm=true (409 1810) and keeps the attachment as detached.
export const detachEventExercise = (eventID: string, attachmentID: string, confirm = false) => request(eventID, `exercises/${attachmentID}${confirm ? "?confirm=true" : ""}`, z.unknown(), "DELETE").then(() => undefined);
export const updateEventBoardChallenge = (eventID: string, attachmentID: string, challengeID: string, input: {Points: number; HintsEnabled: boolean; Published: boolean}) => request(eventID, `exercises/${attachmentID}/challenges/${challengeID}`, challengeSchema, "PUT", input);
export const updateEventChallengeScoring = (eventID: string, attachmentID: string, challengeID: string, override: ChallengeScoringOverride | null) => request(eventID, `exercises/${attachmentID}/challenges/scoring`, z.object({updated: z.number().int()}), "PUT", {ChallengeIDs: [challengeID], Override: override});
// Cost null resets the hint to the exercise's default cost.
export const updateEventChallengeHintCosts = (eventID: string, attachmentID: string, challengeID: string, costs: HintCostInput[]) => request(eventID, `exercises/${attachmentID}/challenges/${challengeID}/hints`, challengeSchema, "PUT", {Costs: costs});
export const getHintUnlocks = (eventID: string) => request(eventID, "hint-unlocks", z.array(hintUnlockSchema).nullable().transform(value => value ?? []));
