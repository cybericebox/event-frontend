import {z} from "zod";
import {getManageTeamFields} from "@/api/manageTeamFields";
import {participantFormSchema, type ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
import {readApiErrorCode} from "@/api/apiErrors";
import {requireApiOrigin} from "@/utils/origins";

export class EventTeamError extends Error {
    constructor(readonly status: number, readonly code?: number) {
        super(`Event team request failed: ${status}`);
    }
}

async function send(eventID: string, path: string, body: Record<string, unknown>, method = "POST"): Promise<Response> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/teams${path}`, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new EventTeamError(response.status, await readApiErrorCode(response));
    return response;
}

// Role follows the backend TeamRole: 0 = captain, 1 = member.
export const TeamRole = {Captain: 0, Member: 1} as const;
const memberSchema = z.object({UserID: z.string().uuid(), DisplayName: z.string(), Role: z.number().int(), Own: z.boolean()});
export type TeamMember = z.infer<typeof memberSchema>;

let mockMembers: TeamMember[] = [
    {UserID: "01900000-0000-7000-8000-000000000031", DisplayName: "Олена Коваль", Role: TeamRole.Captain, Own: true},
    {UserID: "01900000-0000-7000-8000-000000000032", DisplayName: "frost", Role: TeamRole.Member, Own: false},
    {UserID: "01900000-0000-7000-8000-000000000033", DisplayName: "Андрій Мельник", Role: TeamRole.Member, Own: false},
];

export async function getOwnTeamMembers(eventID: string): Promise<TeamMember[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockMembers.map(item => ({...item}));
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/teams/mine/members`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw new EventTeamError(response.status, await readApiErrorCode(response));
    return z.object({Data: memberSchema.array().nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}

// Roster actions are open to participants only before the start (RosterLocked after).
export async function leaveEventTeam(eventID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await send(eventID, "/mine/leave", {});
}
export async function renameEventTeam(eventID: string, teamID: string, name: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await send(eventID, `/${encodeURIComponent(teamID)}`, {Name: name}, "PUT");
}
export async function regenerateEventTeamCode(eventID: string, teamID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await send(eventID, `/${encodeURIComponent(teamID)}/join-code`, {});
}
export async function transferEventTeamCaptain(eventID: string, teamID: string, userID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockMembers = mockMembers.map(item => ({...item, Role: item.UserID === userID ? TeamRole.Captain : TeamRole.Member}));
        return;
    }
    await send(eventID, `/${encodeURIComponent(teamID)}/captain`, {UserID: userID});
}
export async function kickEventTeamMember(eventID: string, teamID: string, userID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockMembers = mockMembers.filter(item => item.UserID !== userID);
        return;
    }
    await send(eventID, `/${encodeURIComponent(teamID)}/members/${encodeURIComponent(userID)}/kick`, {});
}
export async function disbandEventTeam(eventID: string, teamID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await send(eventID, `/${encodeURIComponent(teamID)}`, {}, "DELETE");
}

export const createEventTeam = async (eventID: string, name: string, fields: ParticipantAnswers = {}) => {await send(eventID, "", {Name: name, Fields: fields});};
export const joinEventTeam = async (eventID: string, joinCode: string) => {await send(eventID, "/join", {JoinCode: joinCode});};

// Captain only; editable fields until the event finishes. W3 builds the UI.
export async function updateOwnTeamFields(eventID: string, teamID: string, fields: ParticipantAnswers): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await send(eventID, `/${encodeURIComponent(teamID)}/fields`, {Fields: fields}, "PUT");
}

export async function getSelfTeamFields(eventID: string): Promise<ParticipantForm | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return getManageTeamFields(eventID);
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/self/team-fields`, {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    if (!response.ok) throw new EventTeamError(response.status, await readApiErrorCode(response));
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}
