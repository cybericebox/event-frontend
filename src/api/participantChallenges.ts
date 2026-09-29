import {z} from "zod";
import {ApiErrorCode, readApiErrorCode} from "@/api/apiErrors";
import {LabRuntimeSchema, type LabRuntime} from "@/api/manageLabs";

const id = z.string().uuid();
const attachmentSchema = z.object({file_id: id, name: z.string()});
// Content arrives only once the team unlocked the hint (moderators see every text).
// Cost is what the team pays now, or what it paid.
export const hintSchema = z.object({
    ID: z.string(), Cost: z.number().int().default(0), Unlocked: z.boolean().default(false),
    Content: z.string().nullish().transform(value => value ?? null),
    UnlockedAt: z.string().nullish().transform(value => value ?? null),
    UnlockedByName: z.string().nullish().transform(value => value ?? ""),
});
const snapshotSchema = z.object({
    name: z.string(),
    description: z.unknown().optional(),
    difficulty: z.enum(["trivial", "easy", "medium", "hard", "insane"]).catch("medium"),
    attachments: z.array(attachmentSchema).nullish().transform(value => value ?? []),
});
const fileSchema = z.object({FileID: id, Name: z.string(), Size: z.number().int().default(0)});
const prerequisiteSchema = z.object({EventChallengeID: id, Name: z.string(), Solved: z.boolean()});
export const challengeSchema = z.object({
    ID: id,
    EventChallengeID: id,
    Snapshot: snapshotSchema,
    Readiness: z.number().int(),
    SolvedAt: z.string().nullable(),
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
    // Moderators board only: the challenge is (not yet) on the participants' board.
    BoardPublished: z.boolean().optional(),
});
const submissionSchema = z.object({Correct: z.boolean(), FirstSolve: z.boolean().default(false)});
const solveSchema = z.object({TeamName: z.string(), SolvedAt: z.string(), Own: z.boolean()});
export type OwnChallenge = z.infer<typeof challengeSchema>;
export type ChallengeSubmission = z.infer<typeof submissionSchema>;
export type ChallengeSolve = z.infer<typeof solveSchema>;
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
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    return `https://api.${domain}/api/events/${encodeURIComponent(eventID)}/teams/challenges`;
}

async function failure(response: Response): Promise<ParticipantChallengeError> {
    const retry = Number(response.headers.get("Retry-After"));
    return new ParticipantChallengeError(response.status, await readApiErrorCode(response), Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

const mockID = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const text = (value: string) => ({root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: value}]}]}});
type MockSeed = [string, string, string, number, OwnChallenge["Snapshot"]["difficulty"], Partial<OwnChallenge>?];
const mockGroups: Array<[string, string, MockSeed[]]> = [
    ["1", "Web", [
        ["101", "IceWall", "Знайдіть прапор у панелі керування крижаної фортеці.", 100, "easy", {Infrastructure: true, Files: [{FileID: mockID("1011"), Name: "icewall-src.zip", Size: 1_468_006}], HintsEnabled: true, Hints: [
            {ID: mockID("1101"), Cost: 0, Unlocked: true, Content: "Панель керування слухає не тільки на порту 80.", UnlockedAt: "2026-09-29T09:12:00Z", UnlockedByName: "Андрій Мельник"},
            {ID: mockID("1102"), Cost: 50, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""},
            {ID: mockID("1103"), Cost: 0, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""},
        ]}],
        ["102", "SQL Frostbite", "Дістаньте облікові дані адміністратора.", 250, "medium", {SolvedAt: "2026-09-26T09:14:02Z", SolveCount: 7}],
        ["103", "SSTI у звіті", "Генератор звітів підставляє назву компанії в шаблон.", 300, "medium", {Infrastructure: true, ContentUpdatedAt: new Date(Date.now() - 40 * 60_000).toISOString()}],
        ["104", "Сесія без підпису", "Підробіть сесію адміністратора.", 400, "hard", {Locked: true, Prerequisites: [{EventChallengeID: mockID("102"), Name: "SQL Frostbite", Solved: true}, {EventChallengeID: mockID("103"), Name: "SSTI у звіті", Solved: false}]}],
    ]],
    ["2", "Crypto", [
        ["201", "Glacier Cipher", "Розшифруйте повідомлення, вкарбоване у лід.", 200, "easy", {Files: [{FileID: mockID("2011"), Name: "cipher.txt", Size: 2048}], HintsEnabled: true, HintCostTotal: 40, Hints: [
            {ID: mockID("2101"), Cost: 40, Unlocked: true, Content: "Ключ — назва станції, записана задом наперед.", UnlockedAt: "2026-09-29T10:02:00Z", UnlockedByName: "Олена Коваль"},
        ]}],
        ["202", "RSA на морозі", "Малий показник, великий модуль.", 350, "hard", {SolvedAt: "2026-09-26T10:02:40Z", SolveCount: 3}],
    ]],
    ["3", "Pwn", [
        ["301", "ROP без libc", "Сервіс працює на віддаленому хості. Отримайте shell і прочитайте /flag.", 450, "insane", {Infrastructure: true}],
        ["302", "Форматний рядок", "Логер довіряє користувачу.", 300, "medium"],
    ]],
    ["4", "Forensics", [
        ["401", "Сніговий дамп", "У дампі пам’яті лишився ключ.", 150, "trivial", {SolvedAt: "2026-09-26T08:41:10Z", SolveCount: 12, Files: [{FileID: mockID("4011"), Name: "memdump.raw.gz", Size: 52_428_800}]}],
        ["402", "PCAP з полярної станції", "Хтось вивів дані через DNS.", 250, "medium"],
    ]],
];
let mockChallenges: OwnChallenge[] = mockGroups.flatMap(([group, groupName, items], groupOrder) => items.map(([n, name, description, points, difficulty, extra], order) => challengeSchema.parse({
    ID: mockID(`9${n}`), EventChallengeID: mockID(n),
    Snapshot: {name, difficulty, description: extra?.Locked ? undefined : text(description), attachments: []},
    Readiness: 2, SolvedAt: null, Points: points, Order: order, GroupID: mockID(group), GroupName: groupName, GroupOrder: groupOrder,
    SolveCount: 2, Files: [], Prerequisites: [], ...extra,
})));
const mockFlags: Record<string, string> = {[mockID("101")]: "ICE{ice_wall_breached}", [mockID("201")]: "ICE{glacier_cipher_cracked}", [mockID("103")]: "ICE{demo}"};
let mockAttempts = 0;
const mockHintTexts: Record<string, string> = {
    [mockID("1101")]: "Панель керування слухає не тільки на порту 80.",
    [mockID("1102")]: "Заголовок X-Forwarded-For довіряють без перевірки.",
    [mockID("1103")]: "Подивіться на robots.txt.",
    [mockID("2101")]: "Ключ — назва станції, записана задом наперед.",
};

// Moderators see every hint text; the mock reveals them from here.
export function mockHintText(hintID: string): string {
    return mockHintTexts[hintID] ?? "Текст підказки";
}

export async function getOwnChallenges(eventID: string): Promise<OwnChallenge[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockChallenges.map(item => ({...item}));
    const response = await fetch(`${baseUrl(eventID)}/mine`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await failure(response);
    return z.object({Data: challengeSchema.array().nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}

export async function getChallengeSolves(eventID: string, challengeID: string): Promise<ChallengeSolve[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const item = mockChallenges.find(value => value.EventChallengeID === challengeID);
        const others = ["ColdBoot", "Northwind", "Polar Bytes", "Frost Wolves", "Kernel Panic", "Aurora", "Blizzard", "Icebreakers", "Tundra", "Snowcrash", "Permafrost", "Hailstorm"];
        const rows = others.slice(0, Math.max(0, (item?.SolveCount ?? 0) - (item?.SolvedAt ? 1 : 0))).map((team, index) => ({TeamName: team, SolvedAt: new Date(Date.parse("2026-09-26T08:05:00Z") + index * 11 * 60_000).toISOString(), Own: false}));
        if (item?.SolvedAt) rows.push({TeamName: "Blue Team", SolvedAt: item.SolvedAt, Own: true});
        return rows.sort((a, b) => Date.parse(a.SolvedAt) - Date.parse(b.SolvedAt));
    }
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/solves`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await failure(response);
    return z.object({Data: solveSchema.array().nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}

export async function submitChallenge(eventID: string, challengeID: string, answer: string, idempotencyKey: string): Promise<ChallengeSubmission> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (++mockAttempts % 4 === 0) throw new ParticipantChallengeError(429, undefined, 45);
        const correct = mockFlags[challengeID] === answer;
        if (correct) mockChallenges = mockChallenges.map(item => item.EventChallengeID === challengeID ? {...item, SolvedAt: new Date().toISOString(), SolveCount: (item.SolveCount ?? 0) + 1} : item);
        return {Correct: correct, FirstSolve: correct};
    }
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/submit`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": idempotencyKey},
        body: JSON.stringify({Answer: answer}),
    });
    if (!response.ok) throw await failure(response);
    return z.object({Data: submissionSchema}).parse(await response.json()).Data;
}

export async function getOwnChallengeLab(eventID: string, challengeID: string): Promise<LabRuntime> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return LabRuntimeSchema.parse(challengeID === mockID("301")
            ? {Phase: "Ready", Ready: true, VPNCIDR: "10.10.3.0/24", InternetCIDR: "", Access: [{Device: "pwn", Port: 31337, Protocol: "tcp", URL: ""}]}
            : {Phase: "Ready", Ready: true, VPNCIDR: "10.10.1.0/24", InternetCIDR: "", Access: [{Device: "web", Port: 8080, Protocol: "http", URL: "http://10.10.1.22:8080"}]});
    }
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/lab`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await failure(response);
    return z.object({Data: LabRuntimeSchema}).parse(await response.json()).Data;
}

// Idempotent per team: a repeat returns the first unlock. Cost is 0 once solved or finished.
export async function unlockChallengeHint(eventID: string, challengeID: string, hintID: string): Promise<ChallengeHint> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const challenge = mockChallenges.find(item => item.EventChallengeID === challengeID);
        const hint = challenge?.Hints.find(item => item.ID === hintID);
        if (!challenge) throw new ParticipantChallengeError(404, ApiErrorCode.ChallengeNotFound);
        if (!hint) throw new ParticipantChallengeError(404, ApiErrorCode.HintNotFound);
        if (hint.Unlocked) return hint;
        const cost = challenge.SolvedAt ? 0 : hint.Cost;
        const unlocked: ChallengeHint = {...hint, Cost: cost, Unlocked: true, Content: mockHintText(hintID), UnlockedAt: new Date().toISOString(), UnlockedByName: "Олена Коваль"};
        mockChallenges = mockChallenges.map(item => item !== challenge ? item : {...item, HintCostTotal: item.HintCostTotal + cost, Hints: item.Hints.map(value => value.ID === hintID ? unlocked : value)});
        return unlocked;
    }
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/hints/${encodeURIComponent(hintID)}/unlock`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await failure(response);
    return z.object({Data: hintSchema}).parse(await response.json()).Data;
}

export function challengeAttachmentUrl(eventID: string, challengeID: string, fileID: string): string {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return "data:text/plain;charset=utf-8,Demo%20attachment";
    return `${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/files/${encodeURIComponent(fileID)}`;
}
