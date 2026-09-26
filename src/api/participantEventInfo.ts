import {z} from "zod";
import {ParticipantEventInfoSchema, type ParticipantEventInfo} from "@/types/participantEventInfo";

export class ParticipantEventInfoError extends Error {
    constructor(readonly status: number) {
        super(`Participant event info request failed: ${status}`);
    }
}

export async function getParticipantEventInfo(): Promise<ParticipantEventInfo> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return ParticipantEventInfoSchema.parse({
            EventID: "01900000-0000-7000-8000-000000000001",
            UseVPN: false,
        });
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/self/participant-info`, {
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ParticipantEventInfoError(response.status);
    const body: unknown = await response.json();
    return z.object({Data: ParticipantEventInfoSchema}).parse(body).Data;
}
