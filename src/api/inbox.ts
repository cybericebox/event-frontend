import {z} from "zod";

const itemSchema = z.object({
    ID: z.string(), Title: z.string(), Body: z.string(), Link: z.string(),
    Icon: z.string().optional(), Tone: z.string().optional(), AccentColor: z.string().optional(),
    AutoDismissMs: z.number().nullable().optional(),
    Actions: z.array(z.object({label: z.string(), href: z.string()})).nullable().optional().catch(null),
    ReadAt: z.string().nullable(), CreatedAt: z.string(),
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

export async function getInbox(before?: InboxCursor): Promise<InboxPage> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {Items: [], NextCursor: null};
    const query = before ? `?${new URLSearchParams({before_id: before.ID, before_at: before.CreatedAt})}` : "";
    return listSchema.parse(await inboxRequest(query)).Data;
}

export async function pollInbox(since?: InboxCursor): Promise<InboxPoll> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {Cursor: null, NewInbox: [], UnreadCount: 0};
    const query = since ? `?${new URLSearchParams({since_id: since.ID, since_at: since.CreatedAt})}` : "";
    return pollSchema.parse(await inboxRequest(`/poll${query}`)).Data;
}

export async function markInboxRead(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await inboxRequest(`/${encodeURIComponent(id)}/read`, "PATCH");
}

export async function markInboxAllRead(): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    await inboxRequest("/read-all", "PATCH");
}
