import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {clearMockParticipantTeam, setMockParticipantTeam} from "@/api/manageParticipants";

const id = z.string().uuid();
const teamSchema = z.object({ID: id, Name: z.string(), CaptainID: id, Hidden: z.boolean(), MemberCount: z.number().int(), CreatedAt: z.string()});
const pageSchema = z.object({Items: z.array(teamSchema), Total: z.number().int(), NextCursor: id.optional()});
export type ManageTeam = z.infer<typeof teamSchema>;
export type ManageTeamsPage = z.infer<typeof pageSchema>;

let mockTeams: ManageTeam[] = [{ID: "01900000-0000-7000-8000-000000000022", Name: "Blue Team", CaptainID: "01900000-0000-7000-8000-000000000024", Hidden: false, MemberCount: 1, CreatedAt: "2026-09-26T09:05:00Z"}];

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    if (method === "DELETE" || path.includes("/members/") || path.includes("/captain/")) return schema.parse(null);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageTeams(eventID: string, cursor: string | null): Promise<ManageTeamsPage> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const start = cursor ? Math.max(0, mockTeams.findIndex(item => item.ID === cursor) + 1) : 0;
        return pageSchema.parse({Items: mockTeams.slice(start, start + 20), Total: mockTeams.length, NextCursor: mockTeams.length > start + 20 ? mockTeams[start + 19].ID : undefined});
    }
    const params = new URLSearchParams({pageSize: "20"});
    if (cursor) params.set("cursor", cursor);
    return request(eventID, `teams?${params}`, pageSchema);
}

export async function createManageTeam(eventID: string, name: string, captainID: string): Promise<ManageTeam> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const team = teamSchema.parse({ID: crypto.randomUUID(), Name: name, CaptainID: captainID, Hidden: false, MemberCount: 1, CreatedAt: new Date().toISOString()});
        mockTeams = [...mockTeams, team]; setMockParticipantTeam(captainID, team.ID);
        return team;
    }
    return request(eventID, "teams", teamSchema, "POST", {Name: name, CaptainID: captainID});
}

export async function updateManageTeam(eventID: string, teamID: string, name: string, hidden: boolean): Promise<ManageTeam> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const old = mockTeams.find(item => item.ID === teamID);
        if (!old) throw new ManageApiError(404);
        const updated = teamSchema.parse({...old, Name: name, Hidden: hidden});
        mockTeams = mockTeams.map(item => item.ID === teamID ? updated : item);
        return updated;
    }
    return request(eventID, `teams/${encodeURIComponent(teamID)}`, teamSchema, "PUT", {Name: name, Hidden: hidden});
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
