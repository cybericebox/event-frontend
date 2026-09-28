import {z} from "zod";
import {getManageTeamFields} from "@/api/manageTeamFields";
import {participantFormSchema, type ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
import {readApiErrorCode} from "@/api/apiErrors";

export class EventTeamError extends Error {
    constructor(readonly status: number, readonly code?: number) {
        super(`Event team request failed: ${status}`);
    }
}

async function send(eventID: string, path: string, body: Record<string, unknown>, method = "POST"): Promise<Response> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/teams${path}`, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new EventTeamError(response.status, await readApiErrorCode(response));
    return response;
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
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/self/team-fields`, {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    if (!response.ok) throw new EventTeamError(response.status, await readApiErrorCode(response));
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}
