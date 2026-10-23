import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";
import type {BroadcastChannel} from "@/api/manageBroadcasts";

// «Шаблони розсилок» of an event: saved broadcast messages a manager loads
// into the composer before sending by hand. Not bound to any platform action.
// Reading needs event read access, writing manage access. Fields are PascalCase.

const id = z.string().uuid();
const text = z.string().nullish().transform(value => value ?? "");

const templateSchema = z.object({
    ID: id, ScopeEventID: id.nullable(), Name: text,
    Channels: z.array(z.string()).nullish().transform(value => value ?? []),
    Subject: text, Preheader: text, EmailBody: z.unknown(), EmailStyling: z.unknown(),
    InAppTitle: text, InAppBody: text, InAppLink: text,
    UpdatedBy: id.nullish().transform(value => value ?? null), UpdatedByName: text,
    CreatedAt: z.string(), UpdatedAt: z.string(),
});

export type BroadcastTemplateRecord = z.infer<typeof templateSchema>;

export type BroadcastTemplateInput = {
    Name: string; Channels: BroadcastChannel[]; Subject: string; Preheader: string; EmailBody: unknown[]; EmailStyling: Record<string, unknown>;
    InAppTitle: string; InAppBody: string; InAppLink: string;
};

export const broadcastTemplatesKey = (eventID: string) => ["event-manage-broadcast-templates", eventID] as const;
export const BROADCAST_TEMPLATE_NAME_MAX = 200;

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/broadcast-templates${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export function getBroadcastTemplates(eventID: string): Promise<BroadcastTemplateRecord[]> {
    return request(eventID, "", z.array(templateSchema).nullish().transform(value => value ?? []));
}

export function getBroadcastTemplate(eventID: string, templateID: string): Promise<BroadcastTemplateRecord> {
    return request(eventID, `/${encodeURIComponent(templateID)}`, templateSchema);
}

export function createBroadcastTemplate(eventID: string, input: BroadcastTemplateInput): Promise<BroadcastTemplateRecord> {
    return request(eventID, "", templateSchema, "POST", input);
}

export function updateBroadcastTemplate(eventID: string, templateID: string, input: BroadcastTemplateInput): Promise<BroadcastTemplateRecord> {
    return request(eventID, `/${encodeURIComponent(templateID)}`, templateSchema, "PUT", input);
}

export async function deleteBroadcastTemplate(eventID: string, templateID: string): Promise<void> {
    await request(eventID, `/${encodeURIComponent(templateID)}`, z.unknown(), "DELETE");
}
