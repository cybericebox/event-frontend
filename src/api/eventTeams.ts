export class EventTeamError extends Error {
    constructor(readonly status: number) {
        super(`Event team request failed: ${status}`);
    }
}

async function send(eventID: string, path: string, body: Record<string, unknown>): Promise<void> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/teams${path}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new EventTeamError(response.status);
}

export const createEventTeam = (eventID: string, name: string, fields: ParticipantAnswers = {}) => send(eventID, "", {Name: name, Fields: fields});
export const joinEventTeam = (eventID: string, joinCode: string) => send(eventID, "/join", {JoinCode: joinCode});

export async function getSelfTeamFields(eventID: string): Promise<ParticipantForm | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return getManageTeamFields(eventID);
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/self/team-fields`, {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    if (!response.ok) throw new EventTeamError(response.status);
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}
import {z} from "zod";
import {getManageTeamFields} from "@/api/manageTeamFields";
import {participantFormSchema, type ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
