import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {participantFormSchema, type ParticipantForm, type ParticipantFormInput} from "@/api/manageParticipantForm";
import {requireApiOrigin} from "@/utils/origins";

export async function getManageTeamFields(eventID: string): Promise<ParticipantForm | null> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/team-fields`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}

export async function putManageTeamFields(eventID: string, input: ParticipantFormInput): Promise<ParticipantForm> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/team-fields`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"}, body: JSON.stringify(input),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}
