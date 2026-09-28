import {z} from "zod";
import {manageApiError, ManageApiError} from "@/api/manage";
import {clearMockParticipantTeam, mockTeamInvitations, mockTeamMembers, setMockParticipantTeam} from "@/api/manageParticipants";
import type {ParticipantAnswers} from "@/api/participantForm";

const id = z.string().uuid();
const optionalText = z.string().nullish().transform(value => value ?? "");
const memberSchema = z.object({UserID: id, Name: optionalText, Email: optionalText, Pseudonym: optionalText, Role: z.number().int().default(0)});
const pendingInvitationSchema = z.object({UserID: id, Email: optionalText, Name: optionalText, CreatedAt: z.string(), InvitationSentAt: z.string().nullable().default(null)});
const teamSchema = z.object({
    ID: id, Name: z.string(), CaptainID: id, Hidden: z.boolean(), MemberCount: z.number().int(),
    ExtraFields: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {}), CreatedAt: z.string(),
    Members: z.array(memberSchema).nullish().transform(value => value ?? []),
    PendingInvitations: z.array(pendingInvitationSchema).nullish().transform(value => value ?? []),
    Admitted: z.boolean().default(true), AdmittedManually: z.boolean().default(false),
    MinTeamSize: z.number().int().nullish().transform(value => value ?? null),
});
export type ManageTeamMember = z.infer<typeof memberSchema>;
export type ManageTeamPendingInvitation = z.infer<typeof pendingInvitationSchema>;
export type ManageTeamInput = {Name: string; Hidden: boolean; Fields?: ParticipantAnswers};
const pageSchema = z.object({Items: z.array(teamSchema), Total: z.number().int(), NextCursor: id.optional()});
export type ManageTeam = z.infer<typeof teamSchema>;
export type ManageTeamsPage = z.infer<typeof pageSchema>;

let mockTeams: z.input<typeof teamSchema>[] = [{ID: "01900000-0000-7000-8000-000000000022", Name: "Blue Team", CaptainID: "01900000-0000-7000-8000-000000000024", Hidden: false, MemberCount: 1, ExtraFields: {}, CreatedAt: "2026-09-26T09:05:00Z", MinTeamSize: 2}];

function mockTeam(team: z.input<typeof teamSchema>): ManageTeam {
    const members = mockTeamMembers(team.ID).map(person => ({UserID: person.UserID, Name: person.Name, Email: person.Email, Pseudonym: person.Pseudonym, Role: person.UserID === team.CaptainID ? 1 : 0}));
    const pending = mockTeamInvitations(team.ID).map(person => ({UserID: person.UserID, Email: person.Email, Name: person.Name, CreatedAt: person.CreatedAt, InvitationSentAt: person.InvitationSentAt}));
    const parsed = teamSchema.parse({...team, Members: members, PendingInvitations: pending, MemberCount: members.length});
    return {...parsed, Admitted: parsed.AdmittedManually || members.length >= (parsed.MinTeamSize ?? 2)};
}

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    if (method === "DELETE" || path.includes("/members/") || path.includes("/captain/")) return schema.parse(null);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageTeams(eventID: string, cursor: string | null): Promise<ManageTeamsPage> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const start = cursor ? Math.max(0, mockTeams.findIndex(item => item.ID === cursor) + 1) : 0;
        return {Items: mockTeams.slice(start, start + 20).map(mockTeam), Total: mockTeams.length, NextCursor: mockTeams.length > start + 20 ? mockTeams[start + 19].ID : undefined};
    }
    const params = new URLSearchParams({pageSize: "20"});
    if (cursor) params.set("cursor", cursor);
    return request(eventID, `teams?${params}`, pageSchema);
}

export async function createManageTeam(eventID: string, name: string, captainID: string, fields: Record<string, string | number | boolean | string[]> = {}): Promise<ManageTeam> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const team = {ID: crypto.randomUUID(), Name: name, CaptainID: captainID, Hidden: false, MemberCount: 1, ExtraFields: fields, CreatedAt: new Date().toISOString(), MinTeamSize: 2};
        mockTeams = [...mockTeams, team]; setMockParticipantTeam(captainID, team.ID);
        return mockTeam(team);
    }
    return request(eventID, "teams", teamSchema, "POST", {Name: name, CaptainID: captainID, Fields: fields});
}

export async function updateManageTeam(eventID: string, teamID: string, input: ManageTeamInput): Promise<ManageTeam> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const old = mockTeams.find(item => item.ID === teamID);
        if (!old) throw new ManageApiError(404);
        const updated = {...old, Name: input.Name, Hidden: input.Hidden, ExtraFields: input.Fields ?? old.ExtraFields};
        mockTeams = mockTeams.map(item => item.ID === teamID ? updated : item);
        return mockTeam(updated);
    }
    return request(eventID, `teams/${encodeURIComponent(teamID)}`, teamSchema, "PUT", input);
}

export async function setManageTeamAdmission(eventID: string, teamID: string, admittedManually: boolean): Promise<ManageTeam> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const old = mockTeams.find(item => item.ID === teamID);
        if (!old) throw new ManageApiError(404);
        const updated = {...old, AdmittedManually: admittedManually};
        mockTeams = mockTeams.map(item => item.ID === teamID ? updated : item);
        return mockTeam(updated);
    }
    return request(eventID, `teams/${encodeURIComponent(teamID)}/admission`, teamSchema, "PUT", {AdmittedManually: admittedManually});
}

export async function deleteManageTeam(eventID: string, teamID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockTeams = mockTeams.filter(item => item.ID !== teamID);
        clearMockParticipantTeam(teamID);
        return;
    }
    await request(eventID, `teams/${encodeURIComponent(teamID)}`, z.null(), "DELETE");
}

export async function changeManageTeamMember(eventID: string, teamID: string, userID: string, action: "add" | "remove"): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockTeams = mockTeams.map(team => team.ID === teamID ? {...team, MemberCount: team.MemberCount + (action === "add" ? 1 : -1)} : team);
        setMockParticipantTeam(userID, action === "add" ? teamID : null);
        return;
    }
    await request(eventID, `teams/${encodeURIComponent(teamID)}/members/${encodeURIComponent(userID)}`, z.null(), action === "add" ? "POST" : "DELETE");
}

export async function transferManageTeamCaptain(eventID: string, teamID: string, userID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockTeams = mockTeams.map(team => team.ID === teamID ? {...team, CaptainID: userID} : team);
        return;
    }
    await request(eventID, `teams/${encodeURIComponent(teamID)}/captain/${encodeURIComponent(userID)}`, z.null(), "PUT");
}
