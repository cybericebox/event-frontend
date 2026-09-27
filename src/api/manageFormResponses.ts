import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {formDocumentSchema} from "@/api/manageParticipantForm";

const id = z.string().uuid();
const genericFormSchema = z.object({
    ID: id, EventID: id, Title: z.string(), Enabled: z.boolean(), Required: z.boolean(),
    CurrentVersionID: id, Version: z.number().int(), Document: formDocumentSchema,
    CreatedAt: z.string(), UpdatedAt: z.string(),
});
const baseAnswerSchema = z.object({
    UserID: id, Name: z.string(), Email: z.string(), Answers: z.record(z.string(), z.unknown()),
    Document: formDocumentSchema, SubmittedAt: z.string(),
});
const participantAnswerSchema = baseAnswerSchema.extend({FormVersion: z.number().int()});
const genericAnswerSchema = baseAnswerSchema.extend({FormVersionID: id, Version: z.number().int()});

export type ManageGenericForm = z.infer<typeof genericFormSchema>;
export type ManageParticipantFormAnswer = z.infer<typeof participantAnswerSchema>;
export type ManageGenericFormAnswer = z.infer<typeof genericAnswerSchema>;

const mockSurveyID = "01900000-0000-7000-8000-000000000041";
const mockSurveyVersionID = "01900000-0000-7000-8000-000000000042";
const mockSurveyDocument = {blocks: [
    {id: "feedback", type: "field", key: "feedback", input: "long_text", label: "Що сподобалося в події?", required: true},
    {id: "rating", type: "field", key: "rating", input: "number", label: "Оцінка від 1 до 5", required: false},
]};
const mockGenericForms = [genericFormSchema.parse({
    ID: mockSurveyID, EventID: "01900000-0000-7000-8000-000000000001", Title: "Зворотний зв’язок",
    Enabled: true, Required: false, CurrentVersionID: mockSurveyVersionID, Version: 1,
    Document: mockSurveyDocument, CreatedAt: "2026-09-26T08:00:00Z", UpdatedAt: "2026-09-26T08:00:00Z",
})];
const mockGenericAnswers = [genericAnswerSchema.parse({
    UserID: "01900000-0000-7000-8000-000000000024", Name: "Олена Коваль", Email: "olena@example.test",
    FormVersionID: mockSurveyVersionID, Version: 1, Document: mockSurveyDocument,
    Answers: {feedback: "Зручний формат завдань і командна робота.", rating: 5}, SubmittedAt: "2026-09-26T11:15:00Z",
})];

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageGenericForms(eventID: string): Promise<ManageGenericForm[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockGenericForms;
    return request(eventID, "forms", z.array(genericFormSchema));
}

export async function getManageParticipantFormAnswers(eventID: string): Promise<ManageParticipantFormAnswer[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return [];
    return request(eventID, "participant-form/answers", z.array(participantAnswerSchema));
}

export async function getManageGenericFormAnswers(eventID: string, formID: string): Promise<ManageGenericFormAnswer[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return formID === mockSurveyID ? mockGenericAnswers : [];
    return request(eventID, `forms/${encodeURIComponent(formID)}/answers`, z.array(genericAnswerSchema));
}
