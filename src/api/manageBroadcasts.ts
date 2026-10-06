import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";

// «Розсилка» of an event: a custom message to a chosen audience over email
// and/or in the app (docs/BROADCASTS.md). Fields are PascalCase.

const id = z.string().uuid();
const text = z.string().nullish().transform(value => value ?? "");
const list = <T extends z.ZodType>(item: T) => z.array(item).nullish().transform(value => value ?? []);

export const eventAudienceKinds = ["all_participants", "approved", "pending", "captains", "teams", "participants", "staff"] as const;
export type EventAudienceKind = typeof eventAudienceKinds[number];
export const broadcastChannels = ["email", "in_app"] as const;
export type BroadcastChannel = typeof broadcastChannels[number];

const audienceSchema = z.object({Kind: z.string(), Roles: list(z.string()), UserIDs: list(id), TeamIDs: list(id)});
export type BroadcastAudience = {Kind: string; Roles: string[]; UserIDs: string[]; TeamIDs: string[]};

const broadcastSchema = z.object({
    ID: id, ScopeEventID: id.nullable(), EventName: text, CreatedBy: id.nullable(), CreatedByName: text,
    Channels: list(z.string()), Subject: text, Preheader: text, EmailBody: z.unknown(), EmailStyling: z.unknown(),
    InAppTitle: text, InAppBody: text, InAppLink: text, Audience: audienceSchema,
    RecipientCount: z.number().int(), SentCount: z.number().int(), FailedCount: z.number().int(),
    Status: z.enum(["sending", "done", "failed"]).catch("sending"),
    CreatedAt: z.string(), FinishedAt: z.string().nullable(),
});
const pageSchema = z.object({Items: list(broadcastSchema), Total: z.number().int().default(0), NextCursor: id.nullish().transform(value => value ?? undefined)});
const deliverySchema = z.object({
    DispatchID: id, RecipientUserID: id, RecipientEmail: text, DispatchStatus: text, Channel: text, TargetStatus: text, Error: text,
});

export type Broadcast = z.infer<typeof broadcastSchema>;
export type BroadcastPage = z.infer<typeof pageSchema>;
export type BroadcastDelivery = z.infer<typeof deliverySchema>;
export type BroadcastStatus = Broadcast["Status"];

export type BroadcastInput = {
    Channels: BroadcastChannel[]; Subject: string; Preheader: string; EmailBody: unknown[]; EmailStyling: Record<string, unknown>;
    InAppTitle: string; InAppBody: string; InAppLink: string; Audience: BroadcastAudience;
};

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/broadcasts${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export function getEventBroadcasts(eventID: string, cursor: string | null, limit: number): Promise<BroadcastPage> {
    const params = new URLSearchParams({limit: String(limit)});
    if (cursor) params.set("cursor", cursor);
    return request(eventID, `?${params}`, pageSchema);
}

export function getEventBroadcast(eventID: string, broadcastID: string): Promise<Broadcast> {
    return request(eventID, `/${encodeURIComponent(broadcastID)}`, broadcastSchema);
}

// Failures come first, so the first page is the one worth reading.
export function getEventBroadcastDeliveries(eventID: string, broadcastID: string, limit: number, offset: number): Promise<BroadcastDelivery[]> {
    return request(eventID, `/${encodeURIComponent(broadcastID)}/deliveries?limit=${limit}&offset=${offset}`, z.array(deliverySchema).nullish().transform(value => value ?? []));
}

export async function countEventBroadcastAudience(eventID: string, audience: BroadcastAudience): Promise<number> {
    return (await request(eventID, "/audience-count", z.object({Count: z.number().int()}), "POST", {Audience: audience})).Count;
}

export function sendEventBroadcast(eventID: string, input: BroadcastInput): Promise<Broadcast> {
    return request(eventID, "", broadcastSchema, "POST", input);
}
