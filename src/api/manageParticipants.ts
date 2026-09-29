import {z} from "zod";
import {manageApiError, ManageApiError} from "@/api/manage";
import {ApiErrorCode} from "@/api/apiErrors";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const participantSchema = z.object({
    UserID: id, Name: z.string(), Email: z.string(),
    Pseudonym: z.string().nullish().transform(value => value ?? ""),
    DisplayName: z.string().nullish().transform(value => value ?? ""),
    TeamID: id.nullable(), TeamName: z.string().nullish().transform(value => value ?? ""),
    Hidden: z.boolean(), Invited: z.boolean().default(false),
    InvitedToTeam: z.boolean().default(false), InvitedTeamID: id.nullable().default(null),
    InvitedTeamName: z.string().nullish().transform(value => value ?? ""),
    InvitationSentAt: z.string().nullable().default(null), InvitationExpired: z.boolean().default(false),
    Status: z.union([z.literal(1), z.literal(2), z.literal(3)]), CreatedAt: z.string(), DecidedAt: z.string().nullable(),
    Answers: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {}),
});
const countsSchema = z.object({Participants: z.number().int(), Applications: z.number().int(), Invitations: z.number().int()});
const pageSchema = z.object({Items: z.array(participantSchema), Total: z.number().int(), NextCursor: id.optional(), Counts: countsSchema.optional()});
export type ManageParticipant = z.infer<typeof participantSchema>;
export type ManageParticipantsPage = z.infer<typeof pageSchema>;
export type ManageParticipantCounts = z.infer<typeof countsSchema>;
export type ParticipantStatus = ManageParticipant["Status"];
export type ParticipantListKind = "participants" | "applications" | "invitations";
export type ParticipantInvitationResult = {Email: string; UserID: string | null; Error: string};

type MockParticipant = z.input<typeof participantSchema>;
let mockParticipants: MockParticipant[] = [
    {UserID: "01900000-0000-7000-8000-000000000024", Name: "Олена Коваль", Email: "olena@example.test", Pseudonym: "frost", DisplayName: "frost", TeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue Team", Hidden: false, Status: 2, CreatedAt: "2026-09-26T09:00:00Z", DecidedAt: "2026-09-26T09:03:00Z", Answers: {city: "Київ", experience: "Середній"}},
    {UserID: "01900000-0000-7000-8000-000000000025", Name: "Андрій Бондар", Email: "andrii@example.test", DisplayName: "Андрій Бондар", TeamID: null, Hidden: false, Status: 2, CreatedAt: "2026-09-26T09:10:00Z", DecidedAt: "2026-09-26T09:12:00Z", Answers: {city: "Львів"}},
    {UserID: "01900000-0000-7000-8000-000000000028", Name: "Іван Мельник", Email: "ivan@example.test", TeamID: null, Hidden: false, Status: 1, CreatedAt: "2026-09-26T09:30:00Z", DecidedAt: null, Answers: {city: "Одеса"}},
    {UserID: "01900000-0000-7000-8000-000000000031", Name: "Марія Сокол", Email: "maria@example.test", TeamID: null, Hidden: false, Status: 3, CreatedAt: "2026-09-26T08:45:00Z", DecidedAt: "2026-09-26T08:50:00Z"},
    {UserID: "01900000-0000-7000-8000-000000000032", Name: "", Email: "guest@example.test", TeamID: null, Hidden: false, Invited: true, InvitedToTeam: true, InvitedTeamID: "01900000-0000-7000-8000-000000000022", InvitedTeamName: "Blue Team", InvitationSentAt: null, Status: 1, CreatedAt: "2026-09-26T10:00:00Z", DecidedAt: null},
];

export function participantListKind(participant: Pick<ManageParticipant, "Status" | "Invited">): ParticipantListKind {
    if (participant.Status === 2) return "participants";
    return participant.Invited && participant.Status === 1 ? "invitations" : "applications";
}

function mockCounts(): ManageParticipantCounts {
    const items = mockParticipants.map(item => participantSchema.parse(item));
    return {
        Participants: items.filter(item => participantListKind(item) === "participants").length,
        Applications: items.filter(item => participantListKind(item) === "applications" && item.Status === 1).length,
        Invitations: items.filter(item => participantListKind(item) === "invitations").length,
    };
}

export function mockTeamMembers(teamID: string) {
    return mockParticipants.map(item => participantSchema.parse(item)).filter(item => item.TeamID === teamID && item.Status === 2);
}

export function mockTeamInvitations(teamID: string) {
    return mockParticipants.map(item => participantSchema.parse(item)).filter(item => item.InvitedTeamID === teamID && item.Invited && item.Status === 1);
}

export function setMockParticipantTeam(userID: string, teamID: string | null) {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") mockParticipants = mockParticipants.map(item => item.UserID === userID ? {...item, TeamID: teamID} : item);
}

export function clearMockParticipantTeam(teamID: string) {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") mockParticipants = mockParticipants.map(item => item.TeamID === teamID ? {...item, TeamID: null} : item);
}

export type ParticipantListFilter = {kind?: ParticipantListKind | null; status?: ParticipantStatus | null};

export async function getManageParticipants(eventID: string, filter: ParticipantListFilter, cursor: string | null, pageSize = 20): Promise<ManageParticipantsPage> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const filtered = mockParticipants.map(item => participantSchema.parse(item)).filter(item => (!filter.kind || participantListKind(item) === filter.kind) && (!filter.status || item.Status === filter.status));
        const start = cursor ? Math.max(0, filtered.findIndex(item => item.UserID === cursor) + 1) : 0;
        return pageSchema.parse({Items: filtered.slice(start, start + pageSize), Total: filtered.length, NextCursor: filtered.length > start + pageSize ? filtered[start + pageSize - 1].UserID : undefined, Counts: mockCounts()});
    }
    const api = requireApiOrigin();
    const params = new URLSearchParams({pageSize: String(pageSize)});
    if (filter.kind) params.set("kind", filter.kind);
    if (filter.status) params.set("status", String(filter.status));
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants?${params}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: pageSchema}).parse(await response.json()).Data;
}

export async function decideManageParticipant(eventID: string, userID: string, action: "approve" | "reject"): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const participant = mockParticipants.find(item => item.UserID === userID);
        if (!participant || participant.Status !== 1 || participant.Invited) throw new ManageApiError(409);
        mockParticipants = mockParticipants.map(item => item.UserID === userID ? {...item, Status: action === "approve" ? 2 : 3, DecidedAt: new Date().toISOString()} : item);
        return;
    }
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/${action}`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
}

export async function setIndividualParticipantHidden(eventID: string, userID: string, hidden: boolean): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockParticipants = mockParticipants.map(item => item.UserID === userID ? {...item, Hidden: hidden} : item);
        return;
    }
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/visibility`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Hidden: hidden}),
    });
    if (!response.ok) throw await manageApiError(response);
}

export async function inviteManageParticipants(eventID: string, emails: string[], teamID?: string): Promise<ParticipantInvitationResult[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const results = emails.map(email => ({Email: email, UserID: crypto.randomUUID(), Error: ""}));
        mockParticipants = [...results.map(result => ({UserID: result.UserID, Name: "", Email: result.Email, TeamID: null, Hidden: false, Invited: true, InvitedToTeam: !!teamID, InvitedTeamID: teamID ?? null, InvitationSentAt: new Date().toISOString(), Status: 1 as const, CreatedAt: new Date().toISOString(), DecidedAt: null})), ...mockParticipants];
        return results;
    }
    const api = requireApiOrigin();
    const invitationPath = teamID ? `teams/${encodeURIComponent(teamID)}/invitations` : "participants/invitations";
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${invitationPath}`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Entries: emails.map(Email => ({Email}))}),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: z.array(z.object({Email: z.string(), UserID: z.string(), Error: z.string()}))}).parse(await response.json()).Data.map(result => ({...result, UserID: result.UserID === "00000000-0000-0000-0000-000000000000" ? null : result.UserID}));
}

const resendSchema = z.object({UserID: id, Email: z.string(), InvitationSentAt: z.string().nullable()});
export type InvitationResendResult = z.infer<typeof resendSchema>;

function pendingMockInvitation(userID: string): MockParticipant {
    const participant = mockParticipants.find(item => item.UserID === userID);
    if (!participant || !participant.Invited || participant.Status !== 1) throw new ManageApiError(409, ApiErrorCode.InvitationRequired);
    return participant;
}

export async function resendManageInvitation(eventID: string, userID: string): Promise<InvitationResendResult> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const participant = pendingMockInvitation(userID);
        const sentAt = new Date().toISOString();
        mockParticipants = mockParticipants.map(item => item.UserID === userID ? {...item, InvitationSentAt: sentAt} : item);
        return {UserID: userID, Email: participant.Email, InvitationSentAt: sentAt};
    }
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/invitation/resend`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: resendSchema}).parse(await response.json()).Data;
}

export async function revokeManageInvitation(eventID: string, userID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        pendingMockInvitation(userID);
        mockParticipants = mockParticipants.filter(item => item.UserID !== userID);
        return;
    }
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/invitation`, {
        method: "DELETE", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
}
