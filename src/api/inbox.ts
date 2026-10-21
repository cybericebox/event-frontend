import {z} from "zod";
import {requireApiOrigin} from "@/utils/origins";
import {readApiErrorCode, readRetryAfter} from "./apiErrors";
import type {InboxResolution} from "@/components/event/inboxModel";

// Contract: docs/INBOX-DESIGN.md §8.
const itemSchema = z.object({
    ID: z.string(), Title: z.string(), Body: z.string(), Link: z.string(),
    Surface: z.string().optional(), Dismissible: z.boolean().optional(),
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
    // True when the recipient may close this open request by hand (the server decides).
    Resolvable: z.boolean().optional(),
    ResolvedBy: z.object({ID: z.string(), Name: z.string()}).nullable().optional(),
});
// Cursors are opaque strings; an empty NextCursor means the last page.
const listSchema = z.object({Data: z.object({
    Items: z.array(itemSchema).nullish().transform(value => value ?? []),
    NextCursor: z.string().nullish().transform(value => value || null),
})});
// Counts and OtherEventsCount are read by inboxModel.parseCounts / parseOtherEvents.
const sinceSchema = z.object({Data: z.object({
    Cursor: z.string().nullish().transform(value => value ?? ""),
    Items: z.array(itemSchema).nullish().transform(value => value ?? []),
    Unread: z.number(),
    Counts: z.unknown().optional(), OtherEventsCount: z.unknown().optional(),
})});

export type InboxItem = z.infer<typeof itemSchema>;
export type InboxPage = z.infer<typeof listSchema>["Data"];
export type InboxSince = z.infer<typeof sinceSchema>["Data"];

/** A failed inbox call; `code` is the detail code (errors.{uk,en}.json) when the backend sent one. */
export class InboxError extends Error {
    constructor(readonly status: number, readonly code: number | undefined, readonly retryAfter?: number) {
        super(`Inbox request failed: ${status}`);
    }
}

// `query` comes from inboxModel.inboxQuery (site, event scope, category, before).
async function inboxRequest(path: string, method = "GET"): Promise<unknown> {
    const response = await fetch(`${requireApiOrigin()}/api/notifications/inbox${path}`, {method, credentials: "include", headers: {Accept: "application/json"}});
    if (!response.ok) throw new InboxError(response.status, await readApiErrorCode(response), readRetryAfter(response));
    return response.json().catch(() => null);
}

export async function getInbox(query: string): Promise<InboxPage> {
    return listSchema.parse(await inboxRequest(query)).Data;
}

/** The news after `since` (the cursor of the pulse or of the previous answer; "" = baseline), oldest first. */
export async function getInboxSince(eventID: string | undefined, since: string): Promise<InboxSince> {
    const query = new URLSearchParams({site: "event"});
    if (eventID) query.set("event", eventID);
    query.set("since", since);
    return sinceSchema.parse(await inboxRequest(`?${query}`)).Data;
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
