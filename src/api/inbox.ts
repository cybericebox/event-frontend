import {z} from "zod";

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
});
const cursorSchema = z.object({ID: z.string(), CreatedAt: z.string()});
const listSchema = z.object({Data: z.object({Items: z.array(itemSchema), NextCursor: cursorSchema.nullable()})});
const pollSchema = z.object({Data: z.object({Cursor: cursorSchema.nullable(), NewInbox: z.array(itemSchema), UnreadCount: z.number()})});

export type InboxItem = z.infer<typeof itemSchema>;
export type InboxCursor = z.infer<typeof cursorSchema>;
export type InboxPage = z.infer<typeof listSchema>["Data"];
export type InboxPoll = z.infer<typeof pollSchema>["Data"];

function inboxURL(path = ""): string {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    return `https://api.${domain}/api/notifications/inbox${path}`;
}

async function inboxRequest(path = "", method = "GET"): Promise<unknown> {
    const response = await fetch(inboxURL(path), {method, credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw new Error(`Inbox request failed: ${response.status}`);
    return response.json();
}

// `?event=` narrows the inbox to that Event plus items without an Event (M5).
export function inboxQuery(eventID: string | undefined, params: Record<string, string> = {}): string {
    const query = new URLSearchParams(params);
    if (eventID) query.set("event", eventID);
    const value = query.toString();
    return value ? `?${value}` : "";
}

export async function getInbox(eventID?: string, before?: InboxCursor): Promise<InboxPage> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {Items: [], NextCursor: null};
    const query = inboxQuery(eventID, before ? {before_id: before.ID, before_at: before.CreatedAt} : {});
    return listSchema.parse(await inboxRequest(query)).Data;
}

export async function pollInbox(eventID?: string, since?: InboxCursor): Promise<InboxPoll> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {Cursor: null, NewInbox: [], UnreadCount: 0};
    const query = inboxQuery(eventID, since ? {since_id: since.ID, since_at: since.CreatedAt} : {});
    return pollSchema.parse(await inboxRequest(`/poll${query}`)).Data;
}

export async function markInboxRead(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await inboxRequest(`/${encodeURIComponent(id)}/read`, "PATCH");
}

export async function markInboxAllRead(eventID?: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await inboxRequest(`/read-all${inboxQuery(eventID)}`, "PATCH");
}
