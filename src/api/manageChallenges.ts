import {z} from "zod";
import {ApiErrorCode} from "@/api/apiErrors";
import {ManageApiError, manageApiError} from "@/api/manage";
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

// ── mocks (NEXT_PUBLIC_USE_MOCKS=1) ───────────────────────────────────────
const mid = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, "0")}`;
type MockTask = {Name: string; Difficulty: string; Hints: Array<{Text: string; Cost: number}>};
type MockExercise = {
    ID: string; Name: string; Description: string; Scope: "catalog" | "event"; Infrastructure: boolean; Tags: string[];
    Versions: string[]; VariantCount: number; Tasks: MockTask[]; ForkedFrom?: {ExerciseID: string; VersionID: string};
};
type MockAttachment = {
    ID: string; ExerciseID: string; ExerciseVersionID: string; VariantMode: number; FixedVariantIndex: number | null;
    Revision: number; Status: number; DetachedAt: string | null; CreatedAt: string; HasAttempts: boolean;
};

const mockAttachmentID = mid(10);
let mockExercises: MockExercise[] = [
    {ID: mid(13), Name: "Основи кібербезпеки", Description: "Два навчальні завдання", Scope: "catalog", Infrastructure: false, Tags: ["web"],
        Versions: [mid(20), mid(14), mid(21)], VariantCount: 2, Tasks: [
            {Name: "Перший крок", Difficulty: "easy", Hints: [{Text: "Подивіться на заголовки відповіді сервера.", Cost: 0}, {Text: "Прапор захований у cookie session.", Cost: 50}]},
            {Name: "Фінальне завдання", Difficulty: "medium", Hints: [{Text: "Спробуйте розшифрувати base64 двічі.", Cost: 100}]},
        ]},
    {ID: mid(15), Name: "Мережевий аналіз", Description: "Практичний набір мережевих завдань", Scope: "catalog", Infrastructure: true, Tags: ["network"],
        Versions: [mid(16), mid(22)], VariantCount: 1, Tasks: [{Name: "Перше завдання набору", Difficulty: "easy", Hints: [{Text: "Фільтр dns у Wireshark.", Cost: 25}]}]},
    {ID: mid(30), Name: "Мережевий аналіз", Description: "Копія для цієї події", Scope: "event", Infrastructure: true, Tags: ["network"],
        Versions: [mid(31)], VariantCount: 1, Tasks: [{Name: "Перше завдання набору", Difficulty: "easy", Hints: [{Text: "Фільтр dns у Wireshark.", Cost: 25}]}],
        ForkedFrom: {ExerciseID: mid(15), VersionID: mid(16)}},
    {ID: mid(40), Name: "Вступний квест", Description: "Завдання, створене в цій події", Scope: "event", Infrastructure: false, Tags: [],
        Versions: [mid(41), mid(42)], VariantCount: 3, Tasks: [{Name: "Знайдіть організатора", Difficulty: "trivial", Hints: []}]},
    {ID: mid(50), Name: "Веб-вразливості", Description: "SQLi, XSS і SSRF на живому стенді", Scope: "catalog", Infrastructure: true, Tags: ["web"],
        Versions: [mid(51)], VariantCount: 4, Tasks: [{Name: "Логін без пароля", Difficulty: "medium", Hints: [{Text: "Подумайте про коментарі в SQL.", Cost: 40}]}, {Name: "Відбитий XSS", Difficulty: "easy", Hints: []}]},
    {ID: mid(60), Name: "Криптографія для початківців", Description: "Класичні шифри", Scope: "catalog", Infrastructure: false, Tags: ["crypto"],
        Versions: [mid(61)], VariantCount: 1, Tasks: [{Name: "Цезар", Difficulty: "trivial", Hints: []}]},
];
let mockAttachments: MockAttachment[] = [
    {ID: mockAttachmentID, ExerciseID: mid(13), ExerciseVersionID: mid(14), VariantMode: 0, FixedVariantIndex: null, Revision: 2, Status: 0, DetachedAt: null, CreatedAt: "2026-09-26T00:00:00Z", HasAttempts: true},
    {ID: mid(70), ExerciseID: mid(30), ExerciseVersionID: mid(31), VariantMode: 0, FixedVariantIndex: null, Revision: 2, Status: 0, DetachedAt: null, CreatedAt: "2026-09-26T00:00:00Z", HasAttempts: false},
    {ID: mid(71), ExerciseID: mid(40), ExerciseVersionID: mid(41), VariantMode: 1, FixedVariantIndex: 0, Revision: 1, Status: 0, DetachedAt: null, CreatedAt: "2026-09-27T00:00:00Z", HasAttempts: false},
    {ID: mid(72), ExerciseID: mid(60), ExerciseVersionID: mid(61), VariantMode: 0, FixedVariantIndex: null, Revision: 1, Status: 2, DetachedAt: "2026-09-28T10:00:00Z", CreatedAt: "2026-09-20T00:00:00Z", HasAttempts: true},
];
let mockGroups: EventChallengeGroup[] = [];
const mockBoardByAttachment = new Map<string, EventBoardChallenge[]>();
let mockHintSeq = 200;

function mockChallengesFor(exercise: MockExercise): EventBoardChallenge[] {
    return exercise.Tasks.map((task, index) => ({
        ID: mid(100 + mockHintSeq++), TaskID: mid(300 + mockHintSeq++), GroupID: null, PrerequisiteIDs: [], Order: index,
        Points: 100, ScoringOverride: null, HintsEnabled: task.Hints.length > 0, Published: false, Snapshot: {name: task.Name},
        Hints: task.Hints.map(hint => ({ID: mid(500 + mockHintSeq++), Text: hint.Text, DefaultCost: hint.Cost, Cost: hint.Cost, Overridden: false})),
    }));
}
mockBoardByAttachment.set(mockAttachmentID, [
    {ID: mid(11), TaskID: mid(11), GroupID: null, PrerequisiteIDs: [], Order: 0, Points: 100, ScoringOverride: null, HintsEnabled: true, Published: true, Snapshot: {name: "Перший крок"},
        Hints: [{ID: mid(111), Text: "Подивіться на заголовки відповіді сервера.", DefaultCost: 0, Cost: 0, Overridden: false}, {ID: mid(112), Text: "Прапор захований у cookie session.", DefaultCost: 50, Cost: 30, Overridden: true}]},
    {ID: mid(12), TaskID: mid(12), GroupID: null, PrerequisiteIDs: [], Order: 1, Points: 100, ScoringOverride: null, HintsEnabled: false, Published: false, Snapshot: {name: "Фінальне завдання"},
        Hints: [{ID: mid(121), Text: "Спробуйте розшифрувати base64 двічі.", DefaultCost: 100, Cost: 100, Overridden: false}]},
]);
for (const attachment of mockAttachments.slice(1)) {
    const exercise = mockExercises.find(item => item.ID === attachment.ExerciseID);
    if (exercise) mockBoardByAttachment.set(attachment.ID, mockChallengesFor(exercise));
}
const mockUnlocks: HintUnlock[] = [
    {TeamID: mid(801), TeamName: "Frost Wolves", EventChallengeID: mid(11), ChallengeName: "Перший крок", HintID: mid(112), HintIndex: 1, UnlockedBy: mid(901), UnlockedByName: "Андрій Мельник", UnlockedAt: "2026-09-29T10:42:00Z", Cost: 30},
    {TeamID: mid(802), TeamName: "Polar Bytes", EventChallengeID: mid(11), ChallengeName: "Перший крок", HintID: mid(111), HintIndex: 0, UnlockedBy: mid(902), UnlockedByName: "Ірина Шевченко", UnlockedAt: "2026-09-29T10:15:00Z", Cost: 0},
    {TeamID: mid(801), TeamName: "Frost Wolves", EventChallengeID: mid(11), ChallengeName: "Перший крок", HintID: mid(111), HintIndex: 0, UnlockedBy: mid(903), UnlockedByName: "Олег Бондар", UnlockedAt: "2026-09-29T09:58:00Z", Cost: 0},
];

function mockExerciseByVersion(versionID: string) {
    return mockExercises.find(item => item.Versions.includes(versionID));
}

function mockView(attachment: MockAttachment) {
    const exercise = mockExercises.find(item => item.ID === attachment.ExerciseID)!;
    const latest = exercise.Versions.at(-1)!;
    const source = exercise.ForkedFrom ? mockExercises.find(item => item.ID === exercise.ForkedFrom!.ExerciseID) : undefined;
    const challenges = mockBoardByAttachment.get(attachment.ID) ?? [];
    return {
        ...attachment, ExerciseName: exercise.Name, ReplacesID: null, SupersededAt: null, Scope: exercise.Scope,
        VersionNumber: exercise.Versions.indexOf(attachment.ExerciseVersionID) + 1, LatestVersionID: latest, LatestVersionNumber: exercise.Versions.length,
        UpdateAvailable: latest !== attachment.ExerciseVersionID, Infrastructure: exercise.Infrastructure, VariantCount: exercise.VariantCount,
        ChallengeCount: challenges.length, PublishedCount: challenges.filter(item => item.Published).length,
        Fork: source && exercise.ForkedFrom ? {
            SourceExerciseID: source.ID, SourceExerciseName: source.Name, SourceVersionID: exercise.ForkedFrom.VersionID,
            SourceVersionNumber: source.Versions.indexOf(exercise.ForkedFrom.VersionID) + 1, SourceLatestVersionID: source.Versions.at(-1)!,
            SourceLatestVersionNumber: source.Versions.length, SourceUpdateAvailable: source.Versions.at(-1) !== exercise.ForkedFrom.VersionID,
        } : null,
    };
}

function mockAttachment(attachmentID: string) {
    const attachment = mockAttachments.find(item => item.ID === attachmentID && item.Status === 0);
    if (!attachment) throw new ManageApiError(404);
    return attachment;
}

function replaceMockAttachment(next: MockAttachment) {
    mockAttachments = mockAttachments.map(item => item.ID === next.ID ? next : item);
    return mockView(next);
}

function mockRequest(path: string, method: string, payload: unknown): unknown {
    const [route, queryString] = path.split("?");
    const query = new URLSearchParams(queryString ?? "");
    if (route === "challenge-groups") {
        if (method === "POST") {
            const group = groupSchema.parse({ID: crypto.randomUUID(), ...(payload as {Name: string; Order: number}), CreatedAt: new Date().toISOString()});
            mockGroups = [...mockGroups, group];
            return group;
        }
        return [...mockGroups].sort((a, b) => a.Order - b.Order);
    }
    if (route === "challenge-groups/order") {
        const {GroupIDs} = payload as {GroupIDs: string[]};
        if (GroupIDs.length !== mockGroups.length || mockGroups.some(item => !GroupIDs.includes(item.ID))) throw new ManageApiError(400);
        mockGroups = mockGroups.map(item => ({...item, Order: GroupIDs.indexOf(item.ID)}));
        return null;
    }
    if (route.startsWith("challenge-groups/")) {
        const groupID = route.slice("challenge-groups/".length);
        const group = mockGroups.find(item => item.ID === groupID);
        if (!group) throw new ManageApiError(404);
        if (method === "DELETE") {
            mockGroups = mockGroups.filter(item => item.ID !== groupID);
            for (const [attachmentID, challenges] of mockBoardByAttachment) mockBoardByAttachment.set(attachmentID, challenges.map(item => item.GroupID === groupID ? {...item, GroupID: null} : item));
            return null;
        }
        const updated = groupSchema.parse({...group, ...(payload as {Name: string; Order: number})});
        mockGroups = mockGroups.map(item => item.ID === groupID ? updated : item);
        return updated;
    }
    if (route === "hint-unlocks") return mockUnlocks;
    if (route.startsWith("exercise-catalog/")) {
        const versionID = route.slice("exercise-catalog/".length);
        const exercise = mockExerciseByVersion(versionID);
        if (!exercise) throw new ManageApiError(404);
        const variant = Math.min(Math.max(Number(query.get("variant") ?? 0) || 0, 0), exercise.VariantCount - 1);
        return {ID: exercise.ID, Name: exercise.Name, Description: exercise.Description, VersionID: versionID, VariantCount: exercise.VariantCount, Variant: variant,
            Tasks: exercise.Tasks.map(task => ({Name: variant ? `${task.Name} · варіант ${variant + 1}` : task.Name, Difficulty: task.Difficulty, HintCount: task.Hints.length}))};
    }
    if (route === "exercise-catalog") {
        const search = query.get("search")?.toLocaleLowerCase() ?? "";
        const infrastructure = query.get("infrastructure");
        const used = new Set(mockAttachments.filter(item => item.Status === 0).flatMap(item => {
            const exercise = mockExercises.find(value => value.ID === item.ExerciseID);
            return [item.ExerciseID, exercise?.ForkedFrom?.ExerciseID ?? ""];
        }));
        return mockExercises
            .filter(item => `${item.Name} ${item.Description}`.toLocaleLowerCase().includes(search))
            .filter(item => infrastructure === "yes" ? item.Infrastructure : infrastructure === "no" ? !item.Infrastructure : true)
            .sort((a, b) => (a.Scope === "event" ? 0 : 1) - (b.Scope === "event" ? 0 : 1))
            .map(item => ({ID: item.ID, Name: item.Name, Description: item.Description, PublishedVersionID: item.Versions.at(-1)!, Tags: item.Tags, Scope: item.Scope, Infrastructure: item.Infrastructure, Attached: used.has(item.ID)}));
    }
    if (route === "exercises") {
        if (method === "POST") {
            const input = payload as {ExerciseVersionID: string; VariantMode: number; FixedVariantIndex: number | null};
            const exercise = mockExerciseByVersion(input.ExerciseVersionID);
            if (!exercise) throw new ManageApiError(403, ApiErrorCode.ExerciseNotAvailable);
            const family = new Set([exercise.ID, ...mockExercises.filter(item => item.ForkedFrom?.ExerciseID === exercise.ID).map(item => item.ID)]);
            if (mockAttachments.some(item => family.has(item.ExerciseID) && item.Status === 0)) throw new ManageApiError(409, ApiErrorCode.ExerciseAlreadyAttached);
            const attachment: MockAttachment = {ID: crypto.randomUUID(), ExerciseID: exercise.ID, ...input, Revision: 1, Status: 0, DetachedAt: null, CreatedAt: new Date().toISOString(), HasAttempts: false};
            mockAttachments = [...mockAttachments, attachment];
            mockBoardByAttachment.set(attachment.ID, mockChallengesFor(exercise));
            return mockView(attachment);
        }
        return mockAttachments.map(mockView);
    }
    const attachmentID = route.split("/")[1];
    if (method === "DELETE" && /^exercises\/[^/]+$/.test(route)) {
        const attachment = mockAttachment(attachmentID);
        if (attachment.HasAttempts && query.get("confirm") !== "true") throw new ManageApiError(409, ApiErrorCode.ExerciseDetachNeedsConfirm);
        if (attachment.HasAttempts) {
            replaceMockAttachment({...attachment, Status: 2, DetachedAt: new Date().toISOString()});
            mockBoardByAttachment.set(attachment.ID, (mockBoardByAttachment.get(attachment.ID) ?? []).map(item => ({...item, Published: false})));
        } else {
            mockAttachments = mockAttachments.filter(item => item.ID !== attachment.ID);
            mockBoardByAttachment.delete(attachment.ID);
        }
        return null;
    }
    if (route.endsWith("/update") || route.endsWith("/replace")) {
        const attachment = mockAttachment(attachmentID);
        const exercise = mockExercises.find(item => item.ID === attachment.ExerciseID)!;
        const target = (payload as {ExerciseVersionID?: string} | undefined)?.ExerciseVersionID ?? exercise.Versions.at(-1)!;
        return replaceMockAttachment({...attachment, ExerciseVersionID: target, Revision: attachment.Revision + 1});
    }
    if (route.endsWith("/fork")) {
        const attachment = mockAttachment(attachmentID);
        const source = mockExercises.find(item => item.ID === attachment.ExerciseID)!;
        if (source.Scope !== "catalog") throw new ManageApiError(409, ApiErrorCode.ExerciseNoForkSource);
        let fork = mockExercises.find(item => item.ForkedFrom?.ExerciseID === source.ID);
        if (!fork) {
            fork = {...source, ID: crypto.randomUUID(), Scope: "event", Versions: [crypto.randomUUID()], ForkedFrom: {ExerciseID: source.ID, VersionID: attachment.ExerciseVersionID}};
            mockExercises = [...mockExercises, fork];
        }
        return replaceMockAttachment({...attachment, ExerciseID: fork.ID, ExerciseVersionID: fork.Versions.at(-1)!, Revision: attachment.Revision + 1});
    }
    if (route.endsWith("/revert")) {
        const attachment = mockAttachment(attachmentID);
        const fork = mockExercises.find(item => item.ID === attachment.ExerciseID)!;
        if (!fork.ForkedFrom) throw new ManageApiError(409, ApiErrorCode.ExerciseNoForkSource);
        return replaceMockAttachment({...attachment, ExerciseID: fork.ForkedFrom.ExerciseID, ExerciseVersionID: fork.ForkedFrom.VersionID, Revision: attachment.Revision + 1});
    }
    if (route.endsWith("/challenges")) return mockBoardByAttachment.get(attachmentID) ?? [];
    if (route.endsWith("/challenges/scoring") && method === "PUT") {
        const input = payload as {ChallengeIDs: string[]; Override: ChallengeScoringOverride | null};
        mockBoardByAttachment.set(attachmentID, (mockBoardByAttachment.get(attachmentID) ?? []).map(item => input.ChallengeIDs.includes(item.ID) ? {...item, ScoringOverride: input.Override} : item));
        return {updated: input.ChallengeIDs.length};
    }
    if (route.endsWith("/hints") && method === "PUT") {
        const challengeID = route.split("/").at(-2);
        const {Costs} = payload as {Costs: HintCostInput[]};
        if (Costs.some(item => item.Cost !== null && (!Number.isInteger(item.Cost) || item.Cost < 0 || item.Cost > 10000))) throw new ManageApiError(400, ApiErrorCode.HintCostsInvalid);
        const updated = (mockBoardByAttachment.get(attachmentID) ?? []).map(item => item.ID !== challengeID ? item : {...item, Hints: item.Hints.map(hint => {
            const change = Costs.find(value => value.HintID === hint.ID);
            if (!change) return hint;
            return change.Cost === null ? {...hint, Cost: hint.DefaultCost, Overridden: false} : {...hint, Cost: change.Cost, Overridden: true};
        })});
        mockBoardByAttachment.set(attachmentID, updated);
        return updated.find(item => item.ID === challengeID);
    }
    if (method === "PUT" && /\/challenges\/[^/]+$/.test(route)) {
        const challengeID = route.split("/").at(-1);
        const updated = (mockBoardByAttachment.get(attachmentID) ?? []).map(item => item.ID === challengeID ? {...item, ...(payload as {Points: number; HintsEnabled: boolean; Published: boolean})} : item);
        mockBoardByAttachment.set(attachmentID, updated);
        return updated.find(item => item.ID === challengeID);
    }
    if (route.endsWith("/challenges/order")) {
        const ids = (payload as {ChallengeIDs: string[]}).ChallengeIDs;
        const current = mockBoardByAttachment.get(attachmentID) ?? [];
        mockBoardByAttachment.set(attachmentID, ids.map((challengeID, index) => ({...current.find(item => item.ID === challengeID)!, Order: index})));
        return null;
    }
    if (route.endsWith("/relations")) {
        const challengeID = route.split("/").at(-2);
        const input = payload as {GroupID: string | null; PrerequisiteIDs: string[]};
        mockBoardByAttachment.set(attachmentID, (mockBoardByAttachment.get(attachmentID) ?? []).map(item => item.ID === challengeID ? {...item, ...input} : item));
        return null;
    }
    throw new ManageApiError(404);
}

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return schema.parse(mockRequest(path, method, payload));
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
