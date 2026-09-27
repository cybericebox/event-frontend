import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {genericFormSchema} from "@/api/manageFormResponses";

const id = z.string().uuid();
const pendingFormSchema = z.object({
    Form: genericFormSchema, FormVersionID: id,
    Presentation: z.enum(["modal", "banner", "task"]), Dismissible: z.boolean(),
    Gates: z.array(z.string()).nullable().transform(gates => gates ?? []), CreatedAt: z.string(),
});
export type PendingEventForm = z.infer<typeof pendingFormSchema>;
export type EventFormAnswers = Record<string, string | number | boolean | string[]>;

const mockID = "01900000-0000-7000-8000-000000000041";
const mockVersionID = "01900000-0000-7000-8000-000000000042";
const mockForm = genericFormSchema.parse({
    ID: mockID, EventID: "01900000-0000-7000-8000-000000000001", Title: "Зворотний зв’язок",
    Enabled: true, Required: false, CurrentVersionID: mockVersionID, Version: 1,
    Document: {blocks: [
        {id: "feedback", type: "field", key: "feedback", input: "long_text", label: "Що сподобалося в події?", required: true},
        {id: "rating", type: "field", key: "rating", input: "number", label: "Оцінка від 1 до 5", required: false},
    ]}, CreatedAt: "2026-09-26T08:00:00Z", UpdatedAt: "2026-09-26T08:00:00Z",
});
let mockCompleted = false;

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/forms/${path}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getPendingEventForms(eventID: string): Promise<PendingEventForm[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockCompleted ? [] : [{Form: {...mockForm, EventID: eventID}, FormVersionID: mockVersionID, Presentation: "task", Dismissible: true, Gates: [], CreatedAt: "2026-09-26T10:00:00Z"}];
    return request(eventID, "pending", z.array(pendingFormSchema));
}

export async function getOwnEventForm(eventID: string, formID: string) {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {...mockForm, EventID: eventID};
    return request(eventID, encodeURIComponent(formID), genericFormSchema);
}

export async function submitEventForm(eventID: string, formID: string, formVersionID: string, answers: EventFormAnswers): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {mockCompleted = true; return;}
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/forms/${encodeURIComponent(formID)}/response`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({FormVersionID: formVersionID, Answers: answers}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
}
