import {z} from "zod";

const id = z.string().uuid();
const attachmentSchema = z.object({file_id: id, name: z.string()});
const snapshotSchema = z.object({
    name: z.string(),
    description: z.unknown().optional(),
    difficulty: z.number().optional(),
    attachments: z.array(attachmentSchema).default([]),
});
const challengeSchema = z.object({
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
});
const submissionSchema = z.object({Correct: z.boolean(), FirstSolve: z.boolean()});
export type OwnChallenge = z.infer<typeof challengeSchema>;
export type ChallengeSubmission = z.infer<typeof submissionSchema>;

export class ParticipantChallengeError extends Error {
    constructor(readonly status: number) {
        super(`Participant challenge request failed: ${status}`);
    }
}

function baseUrl(eventID: string): string {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    return `https://api.${domain}/api/events/${encodeURIComponent(eventID)}/teams/challenges`;
}

const mockID = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const mockChallenges = challengeSchema.array().parse([
    {ID: mockID("901"), EventChallengeID: mockID("101"), Snapshot: {name: "IceWall", description: {root: {children: [{type: "paragraph", children: [{type: "text", text: "Знайдіть прапор у панелі керування крижаної фортеці."}]}]}}, attachments: [{file_id: mockID("1011"), name: "icewall.txt"}]}, Readiness: 2, SolvedAt: null, Points: 100, Order: 0, GroupID: mockID("1"), GroupName: "Web", GroupOrder: 0},
    {ID: mockID("902"), EventChallengeID: mockID("102"), Snapshot: {name: "SQL Frostbite", description: {root: {children: [{type: "paragraph", children: [{type: "text", text: "Дістаньте облікові дані адміністратора."}]}]}}, attachments: []}, Readiness: 2, SolvedAt: "2026-09-26T14:00:00Z", Points: 250, Order: 1, GroupID: mockID("1"), GroupName: "Web", GroupOrder: 0},
    {ID: mockID("903"), EventChallengeID: mockID("201"), Snapshot: {name: "Glacier Cipher", description: {root: {children: [{type: "paragraph", children: [{type: "text", text: "Розшифруйте повідомлення, вкарбоване у лід."}]}]}}, attachments: []}, Readiness: 2, SolvedAt: null, Points: 400, Order: 0, GroupID: mockID("2"), GroupName: "Crypto", GroupOrder: 1},
]);

export async function getOwnChallenges(eventID: string): Promise<OwnChallenge[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockChallenges.map(item => ({...item}));
    const response = await fetch(`${baseUrl(eventID)}/mine`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw new ParticipantChallengeError(response.status);
    return z.object({Data: challengeSchema.array()}).parse(await response.json()).Data;
}

export async function submitChallenge(eventID: string, challengeID: string, answer: string, idempotencyKey: string): Promise<ChallengeSubmission> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const correct = ({[mockID("101")]: "CTF{ice_wall_breached}", [mockID("201")]: "CTF{glacier_cipher_cracked}"} as Record<string, string>)[challengeID] === answer;
        if (correct) {
            const item = mockChallenges.find(value => value.EventChallengeID === challengeID);
            if (item) item.SolvedAt = new Date().toISOString();
        }
        return {Correct: correct, FirstSolve: correct};
    }
    const response = await fetch(`${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/submit`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": idempotencyKey},
        body: JSON.stringify({Answer: answer}),
    });
    if (!response.ok) throw new ParticipantChallengeError(response.status);
    return z.object({Data: submissionSchema}).parse(await response.json()).Data;
}

export function challengeAttachmentUrl(eventID: string, challengeID: string, fileID: string): string {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return "data:text/plain;charset=utf-8,Demo%20attachment";
    return `${baseUrl(eventID)}/${encodeURIComponent(challengeID)}/files/${encodeURIComponent(fileID)}`;
}
