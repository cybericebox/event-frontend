import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {apiOrigin, requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const blockSchema = z.object({type: z.string()}).passthrough();
const templateSchema = z.object({
    ID: id, ScopeEventID: id.nullable(), NotificationType: z.string(),
    Status: z.enum(["draft", "published", "unpublished"]),
    Subject: z.string(), Preheader: z.string(), Body: z.array(blockSchema),
    Styling: z.record(z.string(), z.unknown()),
    PublishedAt: z.string().nullable(), UpdatedByUserID: id.nullable(),
    CreatedAt: z.string(), UpdatedAt: z.string(), Source: z.enum(["platform", "event"]),
});
const presetSchema = z.object({ID: id, Name: z.string(), Description: z.string().nullish().transform(value => value ?? ""), Blocks: z.array(blockSchema)});
const previewSchema = z.object({Subject: z.string(), Preheader: z.string(), HTML: z.string()});
export type ManageEmailTemplate = z.infer<typeof templateSchema>;
export type ManageEmailBlock = ManageEmailTemplate["Body"][number];
export type ManageEmailTemplateInput = Pick<ManageEmailTemplate, "NotificationType" | "Subject" | "Preheader" | "Body" | "Styling">;
export type ManageEmailPreview = z.infer<typeof previewSchema>;
export type ManageEmailPreset = z.infer<typeof presetSchema>;
const imageUploadSchema = z.object({FileID: id, Url: z.string()});

export function getManageEmailImageURL(eventID: string, fileID: string): string {
    return apiOrigin ? `${apiOrigin}/api/events/${encodeURIComponent(eventID)}/manage/notification-templates/email/images/${encodeURIComponent(fileID)}` : "";
}

export async function uploadManageEmailImage(eventID: string, templateID: string, file: File): Promise<{FileID: string; Url: string}> {
    const api = requireApiOrigin();
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/notification-templates/email/${encodeURIComponent(templateID)}/images`, {
        method: "POST", credentials: "include", body,
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return imageUploadSchema.parse(z.object({Data: imageUploadSchema}).parse(await response.json()).Data);
}

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/notification-templates/email${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageEmailTemplates(eventID: string): Promise<ManageEmailTemplate[]> {
    return request(eventID, "", z.array(templateSchema));
}

export async function customizeManageEmailTemplate(eventID: string, template: ManageEmailTemplate): Promise<ManageEmailTemplate> {
    return request(eventID, `/${template.ID}/customize`, templateSchema, "POST");
}

export async function rollbackManageEmailTemplate(eventID: string, template: ManageEmailTemplate): Promise<ManageEmailTemplate> {
    return request(eventID, `/${template.ID}/rollback`, templateSchema, "POST");
}

export async function createManageEmailTemplate(eventID: string, input: ManageEmailTemplateInput): Promise<ManageEmailTemplate> {
    return request(eventID, "", templateSchema, "POST", input);
}

export async function updateManageEmailTemplate(eventID: string, templateID: string, input: ManageEmailTemplateInput): Promise<ManageEmailTemplate> {
    return request(eventID, `/${templateID}`, templateSchema, "PUT", input);
}

export async function publishManageEmailTemplate(eventID: string, template: ManageEmailTemplate): Promise<ManageEmailTemplate> {
    return request(eventID, `/${template.ID}/publish`, templateSchema, "POST");
}

export async function resetManageEmailTemplate(eventID: string, notificationType: string): Promise<void> {
    await request(eventID, `/type/${encodeURIComponent(notificationType)}`, z.unknown().optional(), "DELETE");
}

// M8: queues the template (event or inherited platform row) to the current
// user through the regular dispatcher; the result lands in the mail journal.
export async function sendManageEmailTemplateTest(eventID: string, templateID: string): Promise<{Recipient: string}> {
    return request(eventID, `/${encodeURIComponent(templateID)}/test`, z.object({Recipient: z.string()}), "POST");
}

export async function previewManageEmailTemplate(eventID: string, input: ManageEmailTemplateInput): Promise<ManageEmailPreview> {
    return request(eventID, "/preview", previewSchema, "POST", input);
}

// The shared block presets (managed by the platform, read-only here).
export async function getManageEmailPresets(eventID: string): Promise<ManageEmailPreset[]> {
    return request(eventID, "/presets", z.array(presetSchema));
}
