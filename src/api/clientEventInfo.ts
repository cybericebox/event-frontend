import {z} from "zod";
import {PublicEventInfoSchema, type PublicEventInfo} from "@/types/publicEventInfo";
import {requireApiOrigin} from "@/utils/origins";

export class ClientEventInfoError extends Error {
    constructor(readonly status: number, readonly requestId?: string) {
        super(`Event info request failed: ${status}`);
    }
}

async function apiAnswers(api: string): Promise<boolean> {
    try {
        await fetch(`${api}/api/auth/me`, {mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(5000)});
        return true;
    } catch {
        return false;
    }
}

// The platform session is a host-only cookie on api.<domain>. The event
// frontend server never receives it, so unpublished manager identity must be
// requested by the browser directly from the API with credentials included.
export async function getClientEventInfo(): Promise<PublicEventInfo> {
    const api = requireApiOrigin();
    let response: Response;
    try {
        response = await fetch(`${api}/api/events/self/public-info`, {
            credentials: "include",
            cache: "no-store",
            headers: {Accept: "application/json"},
        });
    } catch (error) {
        // The API refuses an unknown event address without CORS headers, which the browser reports as a network
        // error too. An API that still answers (an opaque no-cors answer) means that address: a real 404. One that
        // does not answer at all is an outage.
        if (error instanceof TypeError && await apiAnswers(api)) throw new ClientEventInfoError(404);
        throw error;
    }
    if (!response.ok) throw new ClientEventInfoError(response.status, response.headers.get("X-Request-ID") ?? undefined);
    const body: unknown = await response.json();
    const envelope = z.object({Data: PublicEventInfoSchema}).safeParse(body);
    if (!envelope.success) throw new Error("Invalid event info response");
    return envelope.data.Data;
}
