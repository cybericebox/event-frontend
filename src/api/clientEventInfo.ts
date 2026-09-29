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
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return PublicEventInfoSchema.parse({
            EventID: "01900000-0000-7000-8000-000000000001",
            Tag: "winter-arena-2026", Name: "Winter Arena CTF",
            StartTime: "2026-09-26T00:00:00Z", FinishTime: null,
            Status: 0, Participation: null, Registration: 0,
            CanViewResults: false, CanViewParticipants: false,
            PreviewDescription: "", PreviewPicture: "", LogoURL: "",
            Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
        });
    }
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
