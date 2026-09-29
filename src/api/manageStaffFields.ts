import {z} from "zod";
import {manageApiError} from "@/api/manage";
import type {ParticipantAnswers} from "@/api/participantForm";
import {requireApiOrigin} from "@/utils/origins";

// The staff-only values of one participant or team and who last changed them.
const changeSchema = z.object({
    Keys: z.array(z.string()).nullish().transform(value => value ?? []),
    ActorName: z.string().nullish().transform(value => value ?? ""),
    At: z.string(),
});
const staffFieldsSchema = z.object({
    Values: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {}),
    Change: changeSchema.nullish().transform(value => value ?? null),
});
export type StaffFields = z.infer<typeof staffFieldsSchema>;
export type StaffScope = "participant" | "team";

function path(scope: StaffScope, subjectID: string): string {
    return `${scope === "team" ? "teams" : "participants"}/${encodeURIComponent(subjectID)}/staff-fields`;
}

async function request(eventID: string, scope: StaffScope, subjectID: string, method: "GET" | "PUT", payload?: unknown): Promise<StaffFields> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path(scope, subjectID)}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: staffFieldsSchema}).parse(await response.json()).Data;
}

export function getManageStaffFields(eventID: string, scope: StaffScope, subjectID: string): Promise<StaffFields> {
    return request(eventID, scope, subjectID, "GET");
}

// Only the given keys change; an empty value clears a field.
export function putManageStaffFields(eventID: string, scope: StaffScope, subjectID: string, values: ParticipantAnswers): Promise<StaffFields> {
    return request(eventID, scope, subjectID, "PUT", {Values: values});
}
