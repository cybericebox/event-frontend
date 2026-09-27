import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import {signalLabels} from "@/api/manageNotifications";

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
const previewSchema = z.object({Subject: z.string(), Preheader: z.string(), HTML: z.string()});
export type ManageEmailTemplate = z.infer<typeof templateSchema>;
export type ManageEmailBlock = ManageEmailTemplate["Body"][number];
export type ManageEmailTemplateInput = Pick<ManageEmailTemplate, "NotificationType" | "Subject" | "Preheader" | "Body" | "Styling">;
export type ManageEmailPreview = z.infer<typeof previewSchema>;
const imageUploadSchema = z.object({FileID: id, Url: z.string()});
const mockImages = new Map<string, string>();

export function getManageEmailImageURL(eventID: string, fileID: string): string {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockImages.get(fileID) ?? "";
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    return domain ? `https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/notification-templates/email/images/${encodeURIComponent(fileID)}` : "";
}

export async function uploadManageEmailImage(eventID: string, templateID: string, file: File): Promise<{FileID: string; Url: string}> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (!(["image/png", "image/jpeg", "image/gif"].includes(file.type)) || file.size > 10 * 1024 * 1024) throw new Error("invalid image");
        const uri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
        const FileID = crypto.randomUUID();
        mockImages.set(FileID, uri);
        return {FileID, Url: uri};
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/notification-templates/email/${encodeURIComponent(templateID)}/images`, {
        method: "POST", credentials: "include", body,
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return imageUploadSchema.parse(z.object({Data: imageUploadSchema}).parse(await response.json()).Data);
}

const sampleBody = (description: string): ManageEmailBlock[] => [{type: "rich_text", content: {root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: description, format: 0}]}]}}}];
const mockDate = "2026-09-26T08:00:00Z";
let mockTemplates = Object.entries(signalLabels).map(([signal, label], index) => templateSchema.parse({
    ID: `01900000-0000-7000-8002-${String(index + 1).padStart(12, "0")}`,
    ScopeEventID: null, NotificationType: signal, Status: "published", Source: "platform",
    Subject: `${label.title} · {{.event_name}}`, Preheader: label.description,
    Body: sampleBody(`${label.description} Подія {{event_name}}.`),
    Styling: {text_color: "#292841", heading_color: "#221b54"},
    PublishedAt: mockDate, UpdatedByUserID: null, CreatedAt: mockDate, UpdatedAt: mockDate,
}));

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/notification-templates/email${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageEmailTemplates(eventID: string): Promise<ManageEmailTemplate[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const overridden = new Set(mockTemplates.filter(item => item.Source === "event").map(item => item.NotificationType));
        return mockTemplates.filter(item => item.Source === "event" || !overridden.has(item.NotificationType));
    }
    return request(eventID, "", z.array(templateSchema));
}

function mockMutation(eventID: string, template: ManageEmailTemplate): ManageEmailTemplate {
    const now = new Date().toISOString();
    const value = templateSchema.parse({...template, ID: crypto.randomUUID(), ScopeEventID: eventID, Source: "event", Status: "draft", PublishedAt: null, UpdatedAt: now});
    mockTemplates = [...mockTemplates, value];
    return value;
}

export async function customizeManageEmailTemplate(eventID: string, template: ManageEmailTemplate): Promise<ManageEmailTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockMutation(eventID, template);
    return request(eventID, `/${template.ID}/customize`, templateSchema, "POST");
}

export async function rollbackManageEmailTemplate(eventID: string, template: ManageEmailTemplate): Promise<ManageEmailTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockMutation(eventID, template);
    return request(eventID, `/${template.ID}/rollback`, templateSchema, "POST");
}

export async function createManageEmailTemplate(eventID: string, input: ManageEmailTemplateInput): Promise<ManageEmailTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const now = new Date().toISOString();
        const value = templateSchema.parse({...input, ID: crypto.randomUUID(), ScopeEventID: eventID, Status: "draft", Source: "event", PublishedAt: null, UpdatedByUserID: null, CreatedAt: now, UpdatedAt: now});
        mockTemplates = [...mockTemplates, value];
        return value;
    }
    return request(eventID, "", templateSchema, "POST", input);
}

export async function updateManageEmailTemplate(eventID: string, templateID: string, input: ManageEmailTemplateInput): Promise<ManageEmailTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const current = mockTemplates.find(item => item.ID === templateID);
        if (!current) throw new ManageApiError(404);
        const value = templateSchema.parse({...current, ...input, UpdatedAt: new Date().toISOString()});
        mockTemplates = mockTemplates.map(item => item.ID === templateID ? value : item);
        return value;
    }
    return request(eventID, `/${templateID}`, templateSchema, "PUT", input);
}

export async function publishManageEmailTemplate(eventID: string, template: ManageEmailTemplate): Promise<ManageEmailTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const now = new Date().toISOString();
        const value = templateSchema.parse({...template, Status: "published", PublishedAt: now, UpdatedAt: now});
        mockTemplates = mockTemplates.map(item => item.ID === template.ID ? value : item.Status === "published" && item.NotificationType === template.NotificationType && item.Source === "event" ? {...item, Status: "unpublished"} : item);
        return value;
    }
    return request(eventID, `/${template.ID}/publish`, templateSchema, "POST");
}

export async function resetManageEmailTemplate(eventID: string, notificationType: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockTemplates = mockTemplates.filter(item => item.NotificationType !== notificationType || item.Source === "platform");
        return;
    }
    await request(eventID, `/type/${encodeURIComponent(notificationType)}`, z.unknown().optional(), "DELETE");
}

export async function previewManageEmailTemplate(eventID: string, input: ManageEmailTemplateInput): Promise<ManageEmailPreview> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const html = `<html><body style="font-family:Arial,sans-serif;color:#292841;padding:32px"><main style="max-width:600px;margin:auto"><h1 style="font-size:20px">${escapeHTML(input.Subject.replaceAll("{{.event_name}}", "Winter Arena CTF"))}</h1>${input.Body.map(block => block.type === "rich_text" ? `<p>${escapeHTML(plainText(block).replaceAll("{{event_name}}", "Winter Arena CTF"))}</p>` : block.type === "divider" ? "<hr>" : block.type === "button" ? `<p><a href="#">${escapeHTML(String(block.label ?? "Перейти"))}</a></p>` : block.type === "image" ? `<p><img style="max-width:100%" src="${mockImages.get(String(block.file_id ?? "")) ?? ""}" alt="${escapeHTML(String(block.alt ?? ""))}" /></p>` : "").join("")}</main></body></html>`;
        return {Subject: input.Subject, Preheader: input.Preheader, HTML: html};
    }
    return request(eventID, "/preview", previewSchema, "POST", input);
}

function escapeHTML(value: string) {
    return value.replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"})[char] ?? char);
}

function plainText(block: ManageEmailBlock): string {
    const root = block.content as {root?: {children?: {children?: {type?: string; text?: string; varName?: string}[]}[]}} | undefined;
    return (root?.root?.children ?? []).map(node => (node.children ?? []).map(child => child.type === "variable" ? `{{${child.varName ?? ""}}}` : child.text ?? "").join("")).join("\n\n");
}
