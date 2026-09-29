import {z} from "zod";
import {requireApiOrigin} from "@/utils/origins";
import {readApiErrorCode} from "./apiErrors";
import type {InboxResolution} from "@/components/event/inboxModel";

// Contract: docs/INBOX-DESIGN.md §8.
const itemSchema = z.object({
    ID: z.string(), Title: z.string(), Body: z.string(), Link: z.string(),
    Icon: z.string().optional(), Tone: z.string().optional(), AccentColor: z.string().optional(),
    AutoDismissMs: z.number().nullable().optional(),
    Actions: z.array(z.object({label: z.string(), href: z.string()})).nullable().optional().catch(null),
    ReadAt: z.string().nullable(), CreatedAt: z.string(),
    // M5: the Event the item belongs to; null for system/account items.
    EventID: z.string().nullable().optional().transform(value => value ?? null),
    EventName: z.string().nullable().optional().transform(value => value ?? null),
    EventTag: z.string().nullable().optional().transform(value => value ?? null),
    // Categories (absent on older backends).
    Type: z.string().optional(),
    Category: z.enum(["requests", "personal", "activity"]).optional(),
    ActionRequired: z.boolean().optional(),
    ResolvedAt: z.string().nullable().optional(),
    // An unknown future resolution still renders (the generic «Вирішено» line).
    Resolution: z.string().nullable().optional().transform(value => value as InboxResolution | null | undefined),
    ResolvedBy: z.object({ID: z.string(), Name: z.string()}).nullable().optional(),
});
const cursorSchema = z.object({ID: z.string(), CreatedAt: z.string()});
const listSchema = z.object({Data: z.object({Items: z.array(itemSchema), NextCursor: cursorSchema.nullable()})});
// Counts and OtherEventsCount are read by inboxModel.parseCounts / parseOtherEvents (missing = older backend).
const pollSchema = z.object({Data: z.object({
    Cursor: cursorSchema.nullable(), NewInbox: z.array(itemSchema), UnreadCount: z.number(),
    Counts: z.unknown().optional(), OtherEventsCount: z.unknown().optional(),
})});

export type InboxItem = z.infer<typeof itemSchema>;
export type InboxCursor = z.infer<typeof cursorSchema>;
export type InboxPage = z.infer<typeof listSchema>["Data"];
export type InboxPoll = z.infer<typeof pollSchema>["Data"];

/** A failed inbox call; `code` is the detail code (errors.{uk,en}.json) when the backend sent one. */
export class InboxError extends Error {
    constructor(readonly status: number, readonly code: number | undefined) {
        super(`Inbox request failed: ${status}`);
    }
}

// `query` comes from inboxModel.inboxQuery (category, ?event= scope, cursors).
async function inboxRequest(path: string, method = "GET"): Promise<unknown> {
    const response = await fetch(`${requireApiOrigin()}/api/notifications/inbox${path}`, {method, credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw new InboxError(response.status, await readApiErrorCode(response));
    return response.json().catch(() => null);
}

export async function getInbox(query: string): Promise<InboxPage> {
    return listSchema.parse(await inboxRequest(query)).Data;
}

export async function pollInbox(query: string): Promise<InboxPoll> {
    return pollSchema.parse(await inboxRequest(`/poll${query}`)).Data;
}

export async function markInboxRead(id: string): Promise<void> {
    await inboxRequest(`/${encodeURIComponent(id)}/read`, "PATCH");
}

export async function markInboxAllRead(query: string): Promise<void> {
    await inboxRequest(`/read-all${query}`, "PATCH");
}

export async function resolveInboxRequest(id: string): Promise<void> {
    await inboxRequest(`/${encodeURIComponent(id)}/resolve`, "POST");
}
