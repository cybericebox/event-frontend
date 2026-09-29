import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {formDocumentSchema} from "@/api/manageParticipantForm";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
export const genericFormSchema = z.object({
    ID: id, EventID: id, Title: z.string(), Enabled: z.boolean(), Required: z.boolean(),
    CurrentVersionID: id, Version: z.number().int(), Document: formDocumentSchema,
    CreatedAt: z.string(), UpdatedAt: z.string(),
});
const baseAnswerSchema = z.object({
    UserID: id, Name: z.string(), Email: z.string(), Answers: z.record(z.string(), z.unknown()),
    Document: formDocumentSchema, SubmittedAt: z.string(),
});
const genericAnswerSchema = baseAnswerSchema.extend({FormVersionID: id, Version: z.number().int()});

export type ManageGenericForm = z.infer<typeof genericFormSchema>;
export type ManageGenericFormAnswer = z.infer<typeof genericAnswerSchema>;
export type ManageGenericFormInput = Pick<ManageGenericForm, "Title" | "Enabled" | "Required" | "Document">;

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageGenericForms(eventID: string): Promise<ManageGenericForm[]> {
    return request(eventID, "forms", z.array(genericFormSchema));
}

async function writeForm(eventID: string, path: string, method: "POST" | "PUT", input: ManageGenericFormInput): Promise<ManageGenericForm> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store", headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(input),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: genericFormSchema}).parse(await response.json()).Data;
}

export function createManageGenericForm(eventID: string, input: ManageGenericFormInput): Promise<ManageGenericForm> {
    return writeForm(eventID, "forms", "POST", input);
}

export function updateManageGenericForm(eventID: string, formID: string, input: ManageGenericFormInput): Promise<ManageGenericForm> {
    return writeForm(eventID, `forms/${encodeURIComponent(formID)}`, "PUT", input);
}

export async function sendManageGenericForm(eventID: string, formID: string): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/forms/${encodeURIComponent(formID)}/deliveries`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({Rule: {Trigger: "manual", Audience: {kind: "all_participants"}, Presentation: "task", Dismissible: true, Gates: []}, IncludeFuture: false, Enabled: true}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
}

export async function getManageGenericFormAnswers(eventID: string, formID: string): Promise<ManageGenericFormAnswer[]> {
    return request(eventID, `forms/${encodeURIComponent(formID)}/answers`, z.array(genericAnswerSchema));
}
