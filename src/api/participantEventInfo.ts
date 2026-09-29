import {z} from "zod";
import {ParticipantEventInfoSchema, type ParticipantEventInfo} from "@/types/participantEventInfo";
import {requireApiOrigin} from "@/utils/origins";

export class ParticipantEventInfoError extends Error {
    constructor(readonly status: number) {
        super(`Participant event info request failed: ${status}`);
    }
}

export async function getParticipantEventInfo(): Promise<ParticipantEventInfo> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return ParticipantEventInfoSchema.parse({
            EventID: "01900000-0000-7000-8000-000000000001",
            UseVPN: true,
            CanViewResults: process.env.NEXT_PUBLIC_MOCK_PARTICIPANT === "1",
            CanViewParticipants: false,
            Participation: 1, RealName: "Олена Коваль", Pseudonym: null, DisplayName: "Олена Коваль",
            AllowPseudonyms: true, PseudonymEditable: false, TeamAdmitted: true, MinTeamSize: 2, MaxTeamSize: 5,
            ShowDifficulty: true, ShowHints: true, HasInfrastructureChallenges: true, HintChargeMode: "reward",
        });
    }
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
