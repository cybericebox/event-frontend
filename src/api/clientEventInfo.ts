import {z} from "zod";
import {PublicEventInfoSchema, type PublicEventInfo} from "@/types/publicEventInfo";
import {requireApiOrigin} from "@/utils/origins";

export class ClientEventInfoError extends Error {
    constructor(readonly status: number) {
        super(`Event info request failed: ${status}`);
    }
}

// The platform session is a host-only cookie on api.<domain>. The event
// frontend server never receives it, so unpublished manager identity must be
// requested by the browser directly from the API with credentials included.
export async function getClientEventInfo(): Promise<PublicEventInfo> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/self/public-info`, {
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ClientEventInfoError(response.status);
    const body: unknown = await response.json();
    const envelope = z.object({Data: PublicEventInfoSchema}).safeParse(body);
    if (!envelope.success) throw new Error("Invalid event info response");
    return envelope.data.Data;
}
