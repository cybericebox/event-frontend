import {z} from "zod";
import {ParticipantEventInfoSchema, type ParticipantEventInfo} from "@/types/participantEventInfo";
import {requireApiOrigin} from "@/utils/origins";

export class ParticipantEventInfoError extends Error {
    constructor(readonly status: number) {
        super(`Participant event info request failed: ${status}`);
    }
}

export async function getParticipantEventInfo(): Promise<ParticipantEventInfo> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/self/participant-info`, {
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ParticipantEventInfoError(response.status);
    const body: unknown = await response.json();
    return z.object({Data: ParticipantEventInfoSchema}).parse(body).Data;
}
