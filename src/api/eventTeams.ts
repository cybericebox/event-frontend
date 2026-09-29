import {z} from "zod";
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
// Pending marks an invitee who has not accepted the team invitation yet.
const memberSchema = z.object({UserID: z.string().uuid(), DisplayName: z.string(), Role: z.number().int(), Own: z.boolean(), Pending: z.boolean().default(false)});
export type TeamMember = z.infer<typeof memberSchema>;

export async function getOwnTeamMembers(eventID: string): Promise<TeamMember[]> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/teams/mine/members`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw new EventTeamError(response.status, await readApiErrorCode(response));
    return z.object({Data: memberSchema.array().nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}

// Roster actions follow the join period: an event that closes joining at the start freezes the roster
// there (RosterLocked after), a rolling event keeps it open until it finishes.
export async function leaveEventTeam(eventID: string): Promise<void> {
    await send(eventID, "/mine/leave", {});
}
export async function renameEventTeam(eventID: string, teamID: string, name: string): Promise<void> {
    await send(eventID, `/${encodeURIComponent(teamID)}`, {Name: name}, "PUT");
}
// How long a freshly issued join link stays valid (backend JoinCodeExpiry).
export type JoinLinkExpiry = "none" | "day" | "week" | "start";
export const joinLinkExpiries: JoinLinkExpiry[] = ["none", "day", "week", "start"];

export async function regenerateEventTeamCode(eventID: string, teamID: string, expiry: JoinLinkExpiry): Promise<void> {
    await send(eventID, `/${encodeURIComponent(teamID)}/join-code`, {Expiry: expiry});
}
export async function transferEventTeamCaptain(eventID: string, teamID: string, userID: string): Promise<void> {
    await send(eventID, `/${encodeURIComponent(teamID)}/captain`, {UserID: userID});
}
export async function kickEventTeamMember(eventID: string, teamID: string, userID: string): Promise<void> {
    await send(eventID, `/${encodeURIComponent(teamID)}/members/${encodeURIComponent(userID)}/kick`, {});
}
export async function disbandEventTeam(eventID: string, teamID: string): Promise<void> {
    await send(eventID, `/${encodeURIComponent(teamID)}`, {}, "DELETE");
}

export const createEventTeam = async (eventID: string, name: string, fields: ParticipantAnswers = {}) => {await send(eventID, "", {Name: name, Fields: fields});};
export const joinEventTeam = async (eventID: string, joinCode: string) => {await send(eventID, "/join", {JoinCode: joinCode});};

// Captain only; editable fields until the event finishes. W3 builds the UI.
export async function updateOwnTeamFields(eventID: string, teamID: string, fields: ParticipantAnswers): Promise<void> {
    await send(eventID, `/${encodeURIComponent(teamID)}/fields`, {Fields: fields}, "PUT");
}

export async function getSelfTeamFields(): Promise<ParticipantForm | null> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/self/team-fields`, {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    if (!response.ok) throw new EventTeamError(response.status, await readApiErrorCode(response));
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}
