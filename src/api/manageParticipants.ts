import {z} from "zod";
import {ManageApiError} from "@/api/manage";

const id = z.string().uuid();
const participantSchema = z.object({
    UserID: id, Name: z.string(), Email: z.string(), TeamID: id.nullable(), Hidden: z.boolean(), Invited: z.boolean().default(false),
    Status: z.union([z.literal(1), z.literal(2), z.literal(3)]), CreatedAt: z.string(), DecidedAt: z.string().nullable(),
});
const pageSchema = z.object({Items: z.array(participantSchema), Total: z.number().int(), NextCursor: id.optional()});
export type ManageParticipant = z.infer<typeof participantSchema>;
export type ManageParticipantsPage = z.infer<typeof pageSchema>;
export type ParticipantStatus = ManageParticipant["Status"];
export type ParticipantInvitationResult = {Email: string; UserID: string | null; Error: string};

let mockParticipants: ManageParticipant[] = [
    {UserID: "01900000-0000-7000-8000-000000000024", Name: "Олена Коваль", Email: "olena@example.test", TeamID: "01900000-0000-7000-8000-000000000022", Hidden: false, Invited: false, Status: 2, CreatedAt: "2026-09-26T09:00:00Z", DecidedAt: "2026-09-26T09:03:00Z"},
    {UserID: "01900000-0000-7000-8000-000000000028", Name: "Іван Мельник", Email: "ivan@example.test", TeamID: null, Hidden: false, Invited: false, Status: 1, CreatedAt: "2026-09-26T09:30:00Z", DecidedAt: null},
    {UserID: "01900000-0000-7000-8000-000000000031", Name: "Марія Сокол", Email: "maria@example.test", TeamID: null, Hidden: false, Invited: false, Status: 3, CreatedAt: "2026-09-26T08:45:00Z", DecidedAt: "2026-09-26T08:50:00Z"},
];

export function setMockParticipantTeam(userID: string, teamID: string | null) {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") mockParticipants = mockParticipants.map(item => item.UserID === userID ? {...item, TeamID: teamID} : item);
}

export function clearMockParticipantTeam(teamID: string) {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") mockParticipants = mockParticipants.map(item => item.TeamID === teamID ? {...item, TeamID: null} : item);
}

export async function getManageParticipants(eventID: string, status: ParticipantStatus | null, cursor: string | null, pageSize = 20): Promise<ManageParticipantsPage> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const filtered = mockParticipants.filter(item => status === null || item.Status === status);
        const start = cursor ? Math.max(0, filtered.findIndex(item => item.UserID === cursor) + 1) : 0;
        return pageSchema.parse({Items: filtered.slice(start, start + pageSize), Total: filtered.length, NextCursor: filtered.length > start + pageSize ? filtered[start + pageSize - 1].UserID : undefined});
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const params = new URLSearchParams({pageSize: String(pageSize)});
    if (status !== null) params.set("status", String(status));
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/participants?${params}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: pageSchema}).parse(await response.json()).Data;
}

export async function decideManageParticipant(eventID: string, userID: string, action: "approve" | "reject"): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const participant = mockParticipants.find(item => item.UserID === userID);
        if (!participant || participant.Status !== 1) throw new ManageApiError(409);
        mockParticipants = mockParticipants.map(item => item.UserID === userID ? {...item, Status: action === "approve" ? 2 : 3, DecidedAt: new Date().toISOString()} : item);
        return;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/${action}`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
}

export async function setIndividualParticipantHidden(eventID: string, userID: string, hidden: boolean): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockParticipants = mockParticipants.map(item => item.UserID === userID ? {...item, Hidden: hidden} : item);
        return;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/visibility`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Hidden: hidden}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
}

export async function inviteManageParticipants(eventID: string, emails: string[]): Promise<ParticipantInvitationResult[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const results = emails.map(email => ({Email: email, UserID: crypto.randomUUID(), Error: ""}));
        mockParticipants = [...results.map(result => ({UserID: result.UserID, Name: "", Email: result.Email, TeamID: null, Hidden: false, Invited: true, Status: 1 as const, CreatedAt: new Date().toISOString(), DecidedAt: null})), ...mockParticipants];
        return results;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/participants/invitations`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Entries: emails.map(Email => ({Email}))}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: z.array(z.object({Email: z.string(), UserID: z.string(), Error: z.string()}))}).parse(await response.json()).Data.map(result => ({...result, UserID: result.UserID === "00000000-0000-0000-0000-000000000000" ? null : result.UserID}));
}
