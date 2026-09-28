import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {ContentBlockSchema} from "@/types/eventContent";

export const formInputSchema = z.enum(["text", "long_text", "number", "select", "multi_select", "checkbox"]);
export const formFieldSchema = z.object({
    id: z.string(), type: z.literal("field"), key: z.string(), input: formInputSchema,
    label: z.string(), help: z.string().optional(), required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    // Team fields only: the captain may change this answer after creation.
    editable: z.boolean().optional(),
    condition: z.object({fieldKey: z.string(), operator: z.enum(["equals", "not_equals"]), value: z.union([z.string(), z.number(), z.boolean()])}).optional(),
});
export const formBlockSchema = z.union([formFieldSchema, ContentBlockSchema]);
export const formDocumentSchema = z.object({blocks: z.array(formBlockSchema).nullable().transform(blocks => blocks ?? [])});
export const participantFormSchema = z.object({Version: z.number().int(), Enabled: z.boolean(), Required: z.boolean(), Document: formDocumentSchema});
export type FormField = z.infer<typeof formFieldSchema>;
export type FormBlock = z.infer<typeof formBlockSchema>;
export type FormDocument = z.infer<typeof formDocumentSchema>;
export type ParticipantForm = z.infer<typeof participantFormSchema>;
export type ParticipantFormInput = Pick<ParticipantForm, "Enabled" | "Required" | "Document">;

let mockForm: ParticipantForm | null = {Version: 1, Enabled: true, Required: false, Document: {blocks: [
    {id: "city", type: "field", key: "city", input: "text", label: "Місто"},
    {id: "experience", type: "field", key: "experience", input: "select", label: "Досвід у CTF", options: ["Початковий", "Середній", "Високий"]},
]}};

export async function getManageParticipantForm(eventID: string): Promise<ParticipantForm | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockForm;
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/participant-form`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}

export async function putManageParticipantForm(eventID: string, input: ParticipantFormInput): Promise<ParticipantForm> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockForm = participantFormSchema.parse({...input, Version: (mockForm?.Version ?? 0) + 1});
        return mockForm;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/participant-form`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"}, body: JSON.stringify(input),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}
