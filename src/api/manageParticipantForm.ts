import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {ContentBlockSchema} from "@/types/eventContent";
import {requireApiOrigin} from "@/utils/origins";

export const formInputSchema = z.enum(["text", "long_text", "number", "select", "multi_select", "checkbox"]);
export const formFieldSchema = z.object({
    id: z.string(), type: z.literal("field"), key: z.string(), input: formInputSchema,
    label: z.string(), help: z.string().optional(), required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    // The captain (team fields) or the participant (own fields) may change this answer later.
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

export async function getManageParticipantForm(eventID: string): Promise<ParticipantForm | null> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participant-form`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}

export async function putManageParticipantForm(eventID: string, input: ParticipantFormInput): Promise<ParticipantForm> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participant-form`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"}, body: JSON.stringify(input),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: participantFormSchema}).parse(await response.json()).Data;
}
