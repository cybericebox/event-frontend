import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {genericFormSchema} from "@/api/manageFormResponses";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const pendingFormSchema = z.object({
    Form: genericFormSchema, FormVersionID: id,
    Presentation: z.enum(["modal", "banner", "task"]), Dismissible: z.boolean(),
    Gates: z.array(z.string()).nullable().transform(gates => gates ?? []), CreatedAt: z.string(),
});
export type PendingEventForm = z.infer<typeof pendingFormSchema>;
export type EventFormAnswers = Record<string, string | number | boolean | string[]>;

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/forms/${path}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getPendingEventForms(eventID: string): Promise<PendingEventForm[]> {
    return request(eventID, "pending", z.array(pendingFormSchema));
}

export async function getOwnEventForm(eventID: string, formID: string) {
    return request(eventID, encodeURIComponent(formID), genericFormSchema);
}

export async function submitEventForm(eventID: string, formID: string, formVersionID: string, answers: EventFormAnswers): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/forms/${encodeURIComponent(formID)}/response`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({FormVersionID: formVersionID, Answers: answers}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
}
