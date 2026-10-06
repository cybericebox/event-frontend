import {z} from "zod";
import {attemptLimit} from "@/api/attemptLimit";
import {manageApiError} from "@/api/manage";
import {hintLevelSchema, placeholderSchema} from "@/api/participantChallenges";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
// What a set of tasks reserves: the sum of its container devices in fixed blocks (the server's totals, never recomputed here); Min–Max over its variants (planning reserves the largest).
const resourcesSchema = z.object({Blocks: z.number().int().default(0), CPUMillicores: z.number().default(0), MemoryBytes: z.number().default(0), Devices: z.number().int().default(0)});
const taskResourcesSchema = z.object({Min: resourcesSchema, Max: resourcesSchema});
const amountSchema = z.object({Blocks: z.number().int().default(0), CPUMillicores: z.number().default(0), MemoryBytes: z.number().default(0)});
// What the event reserves: per team the tasks' devices plus the lab group's own pods (VPN, gateway) as a separate line.
const resourcePlanSchema = z.object({
    Tasks: z.array(z.object({
        EventExerciseID: id, ExerciseID: id, ExerciseName: z.string(), Range: taskResourcesSchema, Reserved: resourcesSchema,
        ResourceHeavy: z.boolean().default(false), InternetLab: z.boolean().default(false), NoAgentFits: z.boolean().default(false),
    })).nullish().transform(value => value ?? []),
    TeamTasks: resourcesSchema,
    // Known is false while no laboratory has reported the pods' sizing; TooLarge: the team size or internet labs exceed what a laboratory sizes for.
    Group: z.object({MaxUsers: z.number().int().default(0), InternetLabs: z.number().int().default(0), VPN: amountSchema, Gateway: amountSchema, Known: z.boolean().default(false), TooLarge: z.boolean().default(false)}),
    PerTeam: resourcesSchema, Teams: z.number().int().default(1), TeamsBasis: z.enum(["max_teams", "current"]).catch("current"),
    Total: resourcesSchema, NoAgentFits: z.boolean().default(false),
});
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
    // The stage the set belongs to; null lives for the whole event.
    StageID: id.nullish().transform(value => value ?? null),
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
    ResourceHeavy: z.boolean().default(false),
    Resources: taskResourcesSchema.nullish().transform(value => value ?? null),
    // No laboratory that is used can run this set.
    NoAgentFits: z.boolean().default(false),
});
// Cost is the event's price (0 until set); Overridden says a price is set.
const challengeHintSchema = z.object({ID: id, Text: z.string(), Level: hintLevelSchema.default("nudge"), Cost: z.number().int(), Overridden: z.boolean()});
const challengeSchema = z.object({
    ID: id, TaskID: id, GroupID: id.nullable(), PrerequisiteIDs: z.array(id).nullable().transform(value => value ?? []),
    Order: z.number().int(), Points: z.number().int(),
    // What teams see and score: the event's static value when the task follows a static event, else Points.
    EffectivePoints: z.number().int(), ScoringOverride: scoringOverrideSchema.nullable(), HintsEnabled: z.boolean(), Published: z.boolean(),
    // The task's own limit of wrong flag submissions per team; null = the event's value.
    MaxFlagAttempts: attemptLimit,
    // Place inside the group across the event's sets; null sorts after the ordered ones.
    BoardOrder: z.number().int().nullish().transform(value => value ?? null),
    Snapshot: z.object({name: z.string(), description: z.unknown().optional(), placeholders: z.array(placeholderSchema).nullish().transform(value => value ?? [])}),
    Hints: z.array(challengeHintSchema).nullish().transform(value => value ?? []),
});
const groupSchema = z.object({ID: id, Name: z.string(), Order: z.number().int(), CreatedAt: z.string()});
const catalogChoiceSchema = z.object({
    ID: id, Name: z.string(), Description: z.string(), PublishedVersionID: id,
    Tags: z.array(z.string()).nullish().transform(value => value ?? []),
    Scope: z.enum(["catalog", "event"]).catch("catalog"),
    Infrastructure: z.boolean().default(false),
    Attached: z.boolean().default(false),
    ResourceHeavy: z.boolean().default(false),
    Resources: taskResourcesSchema.nullish().transform(value => value ?? null),
});
const catalogTagSchema = z.object({Tag: z.string(), ExerciseCount: z.number().int()});
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
export type CatalogTag = z.infer<typeof catalogTagSchema>;
export type PublishedExercisePreview = z.infer<typeof catalogPreviewSchema>;
export type ChallengeScoringOverride = z.infer<typeof scoringOverrideSchema>;
export type HintUnlock = z.infer<typeof hintUnlockSchema>;
export type Resources = z.infer<typeof resourcesSchema>;
export type ResourceAmount = z.infer<typeof amountSchema>;
export type TaskResources = z.infer<typeof taskResourcesSchema>;
export type ResourcePlan = z.infer<typeof resourcePlanSchema>;
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

const catalogQuery = (search: string, infrastructure: InfrastructureFilter, tags: string[]) => {
    const query = new URLSearchParams({search});
    if (infrastructure !== "all") query.set("infrastructure", infrastructure);
    // Repeated `tags`: the server keeps exercises with any of them.
    for (const tag of tags) query.append("tags", tag);
    return query.toString();
};

// Group overhead of the event plan: the VPN and the gateway pods of one team's lab group.
export const getEventResourcePlan = (eventID: string) => request(eventID, "resource-plan", resourcePlanSchema);
export const getEventChallengeGroups = (eventID: string) => request(eventID, "challenge-groups", z.array(groupSchema));
export const createEventChallengeGroup = (eventID: string, Name: string, Order: number) => request(eventID, "challenge-groups", groupSchema, "POST", {Name, Order});
export const updateEventChallengeGroup = (eventID: string, groupID: string, Name: string, Order: number) => request(eventID, `challenge-groups/${groupID}`, groupSchema, "PUT", {Name, Order});
// Full ordered list of every group ID; the server reorders in one transaction.
export const reorderEventChallengeGroups = (eventID: string, groupIDs: string[]) => request(eventID, "challenge-groups/order", z.null(), "PUT", {GroupIDs: groupIDs});
export const deleteEventChallengeGroup = (eventID: string, groupID: string) => request(eventID, `challenge-groups/${groupID}`, z.null(), "DELETE");
export const getEventExerciseAttachments = (eventID: string) => request(eventID, "exercises", z.array(attachmentSchema));
export const getEventBoardChallenges = (eventID: string, attachmentID: string) => request(eventID, `exercises/${attachmentID}/challenges`, z.array(challengeSchema));
export const setEventChallengeGroup = (eventID: string, attachmentID: string, challenge: EventBoardChallenge, groupID: string | null) => request(eventID, `exercises/${attachmentID}/challenges/${challenge.ID}/relations`, z.null(), "PUT", {GroupID: groupID, PrerequisiteIDs: challenge.PrerequisiteIDs});
// Complete order of one group's challenges across the event's sets (null = «Без групи»).
export const reorderGroupChallenges = (eventID: string, groupID: string | null, challengeIDs: string[]) => request(eventID, "challenge-order", z.null(), "PUT", {GroupID: groupID, ChallengeIDs: challengeIDs});
// Shows or hides a whole set (its tasks share one infrastructure).
export const setEventExerciseVisibility = (eventID: string, attachmentID: string, published: boolean) => request(eventID, `exercises/${attachmentID}/visibility`, z.unknown(), "PUT", {Published: published}).then(() => undefined);
export const reorderEventBoardChallenges = (eventID: string, attachmentID: string, challengeIDs: string[]) => request(eventID, `exercises/${attachmentID}/challenges/order`, z.null(), "PUT", {ChallengeIDs: challengeIDs});
// Own event exercises first, then the catalog ones available to the event; tags match any.
export const getPublishedExerciseChoices = (eventID: string, search: string, infrastructure: InfrastructureFilter = "all", tags: string[] = []) => request(eventID, `exercise-catalog?${catalogQuery(search, infrastructure, tags)}`, z.array(catalogChoiceSchema));
// Tags of the exercises this event may attach, most used first; an empty prefix returns the most used.
export const getPublishedExerciseTags = (eventID: string, prefix: string, limit = 50) => request(eventID, `exercise-catalog/tags?${new URLSearchParams({prefix, limit: String(limit)})}`, z.array(catalogTagSchema).nullish().transform(value => value ?? []));
export const getPublishedExercisePreview = (eventID: string, versionID: string, variant = 0) => request(eventID, `exercise-catalog/${encodeURIComponent(versionID)}?variant=${variant}`, catalogPreviewSchema);
export const attachEventExercise = (eventID: string, versionID: string, variantMode: 0 | 1, fixedVariantIndex: number | null) => request(eventID, "exercises", attachmentSchema, "POST", {ExerciseVersionID: versionID, VariantMode: variantMode, FixedVariantIndex: fixedVariantIndex});
// «Оновити»: the latest published version; event settings carry over (409 1809 when a removed task has attempts).
// While the set's stage runs the server answers 409 1813 with the affected teams; recreateStands=true confirms recreating their stands.
export const updateEventExercise = (eventID: string, attachmentID: string, versionID?: string, recreateStands = false) => request(eventID, `exercises/${attachmentID}/update`, attachmentSchema, "POST", {...(versionID ? {ExerciseVersionID: versionID} : {}), ...(recreateStands ? {RecreateStands: true} : {})});
// «Налаштувати під захід»: the attachment switches to the event's own copy.
export const forkEventExercise = (eventID: string, attachmentID: string, recreateStands = false) => request(eventID, `exercises/${attachmentID}/fork`, attachmentSchema, "POST", recreateStands ? {RecreateStands: true} : undefined);
// «Повернути оригінал»: back to the catalog version the copy was made from.
export const revertEventExercise = (eventID: string, attachmentID: string, recreateStands = false) => request(eventID, `exercises/${attachmentID}/revert`, attachmentSchema, "POST", recreateStands ? {RecreateStands: true} : undefined);
// With attempts the server wants confirm=true (409 1810) and keeps the attachment as detached.
export const detachEventExercise = (eventID: string, attachmentID: string, confirm = false) => request(eventID, `exercises/${attachmentID}${confirm ? "?confirm=true" : ""}`, z.unknown(), "DELETE").then(() => undefined);
// Visibility is per set: see setEventExerciseVisibility.
export const updateEventBoardChallenge = (eventID: string, attachmentID: string, challengeID: string, input: {Points: number; HintsEnabled: boolean; MaxFlagAttempts?: number | null}) => request(eventID, `exercises/${attachmentID}/challenges/${challengeID}`, challengeSchema, "PUT", input);
export const updateEventChallengeScoring = (eventID: string, attachmentID: string, challengeID: string, override: ChallengeScoringOverride | null) => request(eventID, `exercises/${attachmentID}/challenges/scoring`, z.object({updated: z.number().int()}), "PUT", {ChallengeIDs: [challengeID], Override: override});
// Cost null clears the event's price (the hint becomes free).
export const updateEventChallengeHintCosts = (eventID: string, attachmentID: string, challengeID: string, costs: HintCostInput[]) => request(eventID, `exercises/${attachmentID}/challenges/${challengeID}/hints`, challengeSchema, "PUT", {Costs: costs});
export const getHintUnlocks = (eventID: string) => request(eventID, "hint-unlocks", z.array(hintUnlockSchema).nullable().transform(value => value ?? []));
