import {z} from "zod";
import {ManageApiError} from "@/api/manage";

const id = z.string().uuid();
const scoringOverrideSchema = z.object({
    Mode: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    MinPoints: z.number().int(), MaxPoints: z.number().int(), FloorAtPercent: z.number().int(),
});
const attachmentSchema = z.object({
    ID: id, ExerciseID: id, ExerciseName: z.string(), ExerciseVersionID: id, VariantMode: z.number().int(),
    FixedVariantIndex: z.number().int().nullable(), Revision: z.number().int(),
    Status: z.number().int(), ReplacesID: id.nullable(), SupersededAt: z.string().nullable(), CreatedAt: z.string(),
});
const challengeSchema = z.object({
    ID: id, TaskID: id, GroupID: id.nullable(), PrerequisiteIDs: z.array(id).nullable().transform(value => value ?? []),
    Order: z.number().int(), Points: z.number().int(), ScoringOverride: scoringOverrideSchema.nullable(), HintsEnabled: z.boolean(), Published: z.boolean(),
    Snapshot: z.object({name: z.string()}),
});
const groupSchema = z.object({ID: id, Name: z.string(), Order: z.number().int(), CreatedAt: z.string()});
const catalogChoiceSchema = z.object({ID: id, Name: z.string(), Description: z.string(), PublishedVersionID: id});
const catalogPreviewSchema = z.object({
    ID: id, Name: z.string(), Description: z.string(), VersionID: id, VariantCount: z.number().int(),
    Tasks: z.array(z.object({Name: z.string(), Difficulty: z.string()})),
});

export type EventExerciseAttachment = z.infer<typeof attachmentSchema>;
export type EventBoardChallenge = z.infer<typeof challengeSchema>;
export type EventChallengeGroup = z.infer<typeof groupSchema>;
export type PublishedExerciseChoice = z.infer<typeof catalogChoiceSchema>;
export type PublishedExercisePreview = z.infer<typeof catalogPreviewSchema>;
export type ChallengeScoringOverride = z.infer<typeof scoringOverrideSchema>;

const mockAttachmentID = "01900000-0000-7000-8000-000000000010";
const mockTaskIDs = ["01900000-0000-7000-8000-000000000011", "01900000-0000-7000-8000-000000000012"];
let mockGroups: EventChallengeGroup[] = [];
let mockAttachments: EventExerciseAttachment[] = [{
    ID: mockAttachmentID, ExerciseID: "01900000-0000-7000-8000-000000000013", ExerciseName: "Основи кібербезпеки", ExerciseVersionID: "01900000-0000-7000-8000-000000000014",
    VariantMode: 0, FixedVariantIndex: null, Revision: 1, Status: 0, ReplacesID: null, SupersededAt: null, CreatedAt: "2026-09-26T00:00:00Z",
}];
const mockChallenges: EventBoardChallenge[] = mockTaskIDs.map((taskID, index) => ({
    ID: taskID, TaskID: taskID, GroupID: null, PrerequisiteIDs: [], Order: index,
    Points: 100, ScoringOverride: null, HintsEnabled: false, Published: false, Snapshot: {name: index ? "Фінальне завдання" : "Перший крок"},
}));
const mockBoardByAttachment = new Map<string, EventBoardChallenge[]>([[mockAttachmentID, mockChallenges]]);
const mockCatalog: PublishedExerciseChoice[] = [
    {ID: mockAttachments[0].ExerciseID, Name: "Основи кібербезпеки", Description: "Два навчальні завдання", PublishedVersionID: mockAttachments[0].ExerciseVersionID},
    {ID: "01900000-0000-7000-8000-000000000015", Name: "Мережевий аналіз", Description: "Практичний набір мережевих завдань", PublishedVersionID: "01900000-0000-7000-8000-000000000016"},
];

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (path === "challenge-groups") {
            if (method === "POST") {
                const input = payload as {Name: string; Order: number};
                const group = groupSchema.parse({ID: crypto.randomUUID(), ...input, CreatedAt: new Date().toISOString()});
                mockGroups = [...mockGroups, group];
                return schema.parse(group);
            }
            return schema.parse([...mockGroups].sort((a, b) => a.Order - b.Order));
        }
        if (path === "challenge-groups/order") {
            const {GroupIDs} = payload as {GroupIDs: string[]};
            if (GroupIDs.length !== mockGroups.length || mockGroups.some(item => !GroupIDs.includes(item.ID))) throw new ManageApiError(400);
            mockGroups = mockGroups.map(item => ({...item, Order: GroupIDs.indexOf(item.ID)}));
            return schema.parse(null);
        }
        if (path.startsWith("challenge-groups/")) {
            const groupID = path.slice("challenge-groups/".length);
            const group = mockGroups.find(item => item.ID === groupID);
            if (!group) throw new ManageApiError(404);
            if (method === "DELETE") {
                mockGroups = mockGroups.filter(item => item.ID !== groupID);
                for (const [attachmentID, challenges] of mockBoardByAttachment) mockBoardByAttachment.set(attachmentID, challenges.map(item => item.GroupID === groupID ? {...item, GroupID: null} : item));
                return schema.parse(null);
            }
            const updated = groupSchema.parse({...group, ...(payload as {Name: string; Order: number})});
            mockGroups = mockGroups.map(item => item.ID === groupID ? updated : item);
            return schema.parse(updated);
        }
        if (path.startsWith("exercise-catalog/")) {
            const versionID = path.slice("exercise-catalog/".length);
            const choice = mockCatalog.find(item => item.PublishedVersionID === versionID);
            if (!choice) throw new ManageApiError(404);
            return schema.parse({ID: choice.ID, Name: choice.Name, Description: choice.Description, VersionID: versionID, VariantCount: 1, Tasks: choice.ID === mockCatalog[0].ID ? [{Name: "Перший крок", Difficulty: "easy"}, {Name: "Фінальне завдання", Difficulty: "medium"}] : [{Name: "Перше завдання набору", Difficulty: "easy"}]});
        }
        if (path.startsWith("exercise-catalog")) {
            const search = new URLSearchParams(path.split("?")[1] ?? "").get("search")?.toLocaleLowerCase() ?? "";
            return schema.parse(mockCatalog.filter(item => `${item.Name} ${item.Description}`.toLocaleLowerCase().includes(search)));
        }
        if (path === "exercises") {
            if (method === "POST") {
                const input = payload as {ExerciseVersionID: string; VariantMode: number; FixedVariantIndex: number | null};
                const choice = mockCatalog.find(item => item.PublishedVersionID === input.ExerciseVersionID);
                if (!choice || mockAttachments.some(item => item.ExerciseID === choice.ID && item.Status === 0)) throw new ManageApiError(409);
                const attachment = attachmentSchema.parse({ID: crypto.randomUUID(), ExerciseID: choice.ID, ExerciseName: choice.Name, ...input, Revision: 1, Status: 0, ReplacesID: null, SupersededAt: null, CreatedAt: new Date().toISOString()});
                mockAttachments = [...mockAttachments, attachment];
                mockBoardByAttachment.set(attachment.ID, [{ID: crypto.randomUUID(), TaskID: crypto.randomUUID(), GroupID: null, PrerequisiteIDs: [], Order: 0, Points: 100, ScoringOverride: null, HintsEnabled: false, Published: false, Snapshot: {name: "Перше завдання набору"}}]);
                return schema.parse(attachment);
            }
            return schema.parse(mockAttachments);
        }
        const attachmentID = path.split("/")[1];
        if (path.endsWith("/challenges")) return schema.parse(mockBoardByAttachment.get(attachmentID) ?? []);
        if (path.endsWith("/challenges/scoring") && method === "PUT") {
            const input = payload as {ChallengeIDs: string[]; Override: ChallengeScoringOverride | null};
            mockBoardByAttachment.set(attachmentID, (mockBoardByAttachment.get(attachmentID) ?? []).map(item => input.ChallengeIDs.includes(item.ID) ? {...item, ScoringOverride: input.Override} : item));
            return schema.parse({updated: input.ChallengeIDs.length});
        }
        if (method === "PUT" && /\/challenges\/[^/]+$/.test(path)) {
            const challengeID = path.split("/").at(-1);
            const input = payload as {Points: number; HintsEnabled: boolean; Published: boolean};
            const updated = (mockBoardByAttachment.get(attachmentID) ?? []).map(item => item.ID === challengeID ? {...item, ...input} : item);
            mockBoardByAttachment.set(attachmentID, updated);
            return schema.parse(updated.find(item => item.ID === challengeID));
        }
        if (path.endsWith("/challenges/order")) {
            const ids = (payload as {ChallengeIDs: string[]}).ChallengeIDs;
            const current = mockBoardByAttachment.get(attachmentID) ?? [];
            mockBoardByAttachment.set(attachmentID, ids.map((challengeID, index) => ({...current.find(item => item.ID === challengeID)!, Order: index})));
            return schema.parse(null);
        }
        if (path.endsWith("/relations")) {
            const challengeID = path.split("/").at(-2);
            const input = payload as {GroupID: string | null; PrerequisiteIDs: string[]};
            mockBoardByAttachment.set(attachmentID, (mockBoardByAttachment.get(attachmentID) ?? []).map(item => item.ID === challengeID ? {...item, ...input} : item));
            return schema.parse(null);
        }
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
export const getPublishedExerciseChoices = (eventID: string, search: string) => request(eventID, `exercise-catalog?search=${encodeURIComponent(search)}`, z.array(catalogChoiceSchema));
export const getPublishedExercisePreview = (eventID: string, versionID: string) => request(eventID, `exercise-catalog/${encodeURIComponent(versionID)}`, catalogPreviewSchema);
export const attachEventExercise = (eventID: string, versionID: string, variantMode: 0 | 1, fixedVariantIndex: number | null) => request(eventID, "exercises", attachmentSchema, "POST", {ExerciseVersionID: versionID, VariantMode: variantMode, FixedVariantIndex: fixedVariantIndex});
export const updateEventBoardChallenge = (eventID: string, attachmentID: string, challengeID: string, input: {Points: number; HintsEnabled: boolean; Published: boolean}) => request(eventID, `exercises/${attachmentID}/challenges/${challengeID}`, challengeSchema, "PUT", input);
export const updateEventChallengeScoring = (eventID: string, attachmentID: string, challengeID: string, override: ChallengeScoringOverride | null) => request(eventID, `exercises/${attachmentID}/challenges/scoring`, z.object({updated: z.number().int()}), "PUT", {ChallengeIDs: [challengeID], Override: override});
