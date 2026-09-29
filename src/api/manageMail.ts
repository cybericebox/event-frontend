import {z} from "zod";
import {ManageApiError, manageApiError} from "@/api/manage";
import {ApiErrorCode} from "@/api/apiErrors";

// W7 «Пошта»: event sender identity, contact address, start reminder,
// optional event SMTP and the delivery journal (spec 2026-09-29 §6).

export type MailTLSMode = "starttls" | "tls";
export type MailTransport = "event" | "platform" | "env";
export type MailResult = "done" | "error";

export const tlsModeOptions: {value: MailTLSMode; label: string}[] = [
    {value: "starttls", label: "STARTTLS (587)"},
    {value: "tls", label: "TLS (465)"},
];
export const defaultPortByTLSMode: Record<MailTLSMode, number> = {starttls: 587, tls: 465};
export const mailTransportLabels: Record<MailTransport, string> = {event: "SMTP заходу", platform: "Платформа", env: "Резервний (env)"};
export const mailResultLabels: Record<MailResult, string> = {done: "Надіслано", error: "Помилка"};

export function mailTransportLabel(value: string): string {
    return mailTransportLabels[value as MailTransport] ?? (value || "—");
}

const smtpSchema = z.object({
    Host: z.string(), Port: z.number().int(), TLSMode: z.string(), Username: z.string(),
    PasswordSet: z.boolean(), UpdatedAt: z.string().nullable().optional(),
});
const settingsSchema = z.object({
    ContactEmail: z.string().nullable().transform(value => value ?? ""),
    StartReminderHours: z.number().int(),
    SenderName: z.string(), SenderAddress: z.string(), ReplyTo: z.string(),
    SMTP: smtpSchema.nullable(),
    PlatformConfigured: z.boolean(),
});
const testResultSchema = z.object({
    Sent: z.boolean(), Recipient: z.string().default(""), Transport: z.string().default(""), Error: z.string().default(""),
});
const targetSchema = z.object({
    Channel: z.string(), Status: z.string(), Error: z.string().default(""), Attempts: z.number().int().default(0),
    Transport: z.string().default(""), Recipient: z.string().default(""), FallbackError: z.string().default(""),
    UpdatedAt: z.string(),
});
const journalItemSchema = z.object({
    ID: z.string(), NotificationType: z.string(), RecipientUserID: z.string().optional(), Status: z.string(),
    CreatedAt: z.string(), UpdatedAt: z.string(),
    ScopeEventID: z.string().nullable().optional(), EventName: z.string().nullable().optional(),
    RecipientEmail: z.string().nullable().optional().transform(value => value ?? ""),
    Targets: z.array(targetSchema).nullable().optional().transform(value => value ?? []),
});
const journalPageSchema = z.object({
    Total: z.number().int(), Items: z.array(journalItemSchema), NextCursor: z.string().nullable().optional(),
});

export type EventMailSettings = z.infer<typeof settingsSchema>;
export type EventMailSMTP = z.infer<typeof smtpSchema>;
export type MailTestResult = z.infer<typeof testResultSchema>;
export type MailJournalTarget = z.infer<typeof targetSchema>;
export type MailJournalItem = z.infer<typeof journalItemSchema>;
export type MailJournalPage = z.infer<typeof journalPageSchema>;

// --- form state and payload builders ---

export type MailSettingsForm = {contactEmail: string; startReminderHours: string};
export type MailSettingsInput = {ContactEmail: string; StartReminderHours: number};

export function mailSettingsForm(settings: EventMailSettings): MailSettingsForm {
    return {contactEmail: settings.ContactEmail, startReminderHours: String(settings.StartReminderHours)};
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mailSettingsError(form: MailSettingsForm): string {
    const email = form.contactEmail.trim();
    if (email && !emailPattern.test(email)) return "Вкажіть коректну адресу контактної пошти.";
    const hours = form.startReminderHours.trim();
    if (!/^\d+$/.test(hours) || Number(hours) > 168) return "Нагадування — ціле число годин від 0 до 168.";
    return "";
}

export function mailSettingsInput(form: MailSettingsForm): MailSettingsInput {
    return {ContactEmail: form.contactEmail.trim(), StartReminderHours: Number(form.startReminderHours.trim())};
}

export type SMTPForm = {host: string; port: string; tlsMode: MailTLSMode; username: string; password: string; clearPassword: boolean};
export type SMTPInput = {Host: string; Port: number; TLSMode: MailTLSMode; Username: string; Password: string; ClearPassword: boolean};

export function smtpForm(smtp: EventMailSMTP | null): SMTPForm {
    const tlsMode: MailTLSMode = smtp?.TLSMode === "tls" ? "tls" : "starttls";
    return {host: smtp?.Host ?? "", port: smtp ? String(smtp.Port) : String(defaultPortByTLSMode[tlsMode]), tlsMode, username: smtp?.Username ?? "", password: "", clearPassword: false};
}

export function smtpError(form: SMTPForm): string {
    if (!form.host.trim()) return "Вкажіть хост SMTP.";
    if (/\s/.test(form.host.trim())) return "Хост SMTP не може містити пробілів.";
    const port = form.port.trim();
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) return "Порт — ціле число від 1 до 65535.";
    return "";
}

// Empty Password keeps the stored one; ClearPassword removes it and wins over
// a typed password (the explicit «Видалити пароль» action).
export function smtpInput(form: SMTPForm): SMTPInput {
    return {
        Host: form.host.trim(), Port: Number(form.port.trim()), TLSMode: form.tlsMode, Username: form.username.trim(),
        Password: form.clearPassword ? "" : form.password, ClearPassword: form.clearPassword,
    };
}

export type MailJournalFilters = {type: string | null; result: MailResult | null; transport: MailTransport | null; channel: string};
export const emptyMailJournalFilters: MailJournalFilters = {type: null, result: null, transport: null, channel: "email"};
export const mailJournalPageSize = 25;

export function mailJournalQueryParams(filters: MailJournalFilters, cursor: string | null = null, limit = mailJournalPageSize): URLSearchParams {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (filters.channel) params.set("channel", filters.channel);
    if (filters.type) params.set("type", filters.type);
    if (filters.result) params.set("result", filters.result);
    if (filters.transport) params.set("transport", filters.transport);
    if (cursor) params.set("cursor", cursor);
    return params;
}

// The target row of the channel shown in the journal; null = not attempted yet.
export function journalTarget(item: MailJournalItem, channel: string): MailJournalTarget | null {
    return item.Targets.find(target => target.Channel === channel) ?? null;
}

// --- mocks ---

const mockEventID = "01900000-0000-7000-8000-000000000001";
let mockSettings: EventMailSettings = {
    ContactEmail: "", StartReminderHours: 24,
    SenderName: "Winter Arena CTF", SenderAddress: "winter-arena@mail.cybericebox.com", ReplyTo: "support@cybericebox.com",
    SMTP: null, PlatformConfigured: true,
};
let mockStoredPassword = false;

function mockTarget(status: MailResult, transport: MailTransport, recipient: string, at: string, extra: Partial<MailJournalTarget> = {}): MailJournalTarget {
    return {Channel: "email", Status: status, Error: "", Attempts: 1, Transport: transport, Recipient: recipient, FallbackError: "", UpdatedAt: at, ...extra};
}

function mockItem(index: number, type: string, email: string, at: string, targets: MailJournalTarget[]): MailJournalItem {
    return {
        ID: `01900000-0000-7000-8003-${String(index).padStart(12, "0")}`, NotificationType: type,
        RecipientUserID: `01900000-0000-7000-8004-${String(index).padStart(12, "0")}`, Status: "done",
        CreatedAt: at, UpdatedAt: at, ScopeEventID: mockEventID, EventName: "Winter Arena CTF", RecipientEmail: email, Targets: targets,
    };
}

const mockJournal: MailJournalItem[] = [
    mockItem(12, "participant.event.start_reminder", "olena.koval@example.com", "2026-09-29T08:00:12Z", [mockTarget("done", "event", "olena.koval@example.com", "2026-09-29T08:00:14Z"), {...mockTarget("done", "event", "", "2026-09-29T08:00:13Z"), Channel: "in_app", Transport: "", Recipient: ""}]),
    mockItem(11, "participant.event.start_reminder", "andrii.bondar@example.com", "2026-09-29T08:00:11Z", [mockTarget("done", "platform", "andrii.bondar@example.com", "2026-09-29T08:00:19Z", {Attempts: 2, FallbackError: "dial tcp 10.0.4.12:587: i/o timeout"})]),
    mockItem(10, "participant.event.start_reminder", "maria.sokol@example.com", "2026-09-29T08:00:10Z", [mockTarget("error", "platform", "maria.sokol@example.com", "2026-09-29T08:05:40Z", {Attempts: 4, Error: "550 5.1.1 mailbox unavailable", FallbackError: "535 5.7.8 authentication failed"})]),
    mockItem(9, "participant.invitation.sent", "ivan.melnyk@example.com", "2026-09-28T16:42:00Z", [mockTarget("done", "event", "ivan.melnyk@example.com", "2026-09-28T16:42:02Z")]),
    mockItem(8, "participant.team_invitation.sent", "yulia.tkachenko@example.com", "2026-09-28T15:10:00Z", [mockTarget("done", "event", "yulia.tkachenko@example.com", "2026-09-28T15:10:03Z")]),
    mockItem(7, "participant.approval_registration.approved", "taras.shevchuk@example.com", "2026-09-28T12:03:00Z", [mockTarget("done", "platform", "taras.shevchuk@example.com", "2026-09-28T12:03:01Z")]),
    mockItem(6, "participant.invitation.revoked", "dmytro.lysenko@example.com", "2026-09-27T18:20:00Z", [mockTarget("done", "env", "dmytro.lysenko@example.com", "2026-09-27T18:20:02Z")]),
    mockItem(5, "participant.approval_registration.submitted", "kateryna.moroz@example.com", "2026-09-27T09:44:00Z", [mockTarget("error", "platform", "kateryna.moroz@example.com", "2026-09-27T09:59:00Z", {Attempts: 5, Error: "mail is not configured"})]),
    mockItem(4, "participant.invitation.expired", "serhii.kravets@example.com", "2026-09-26T21:00:00Z", [mockTarget("done", "platform", "serhii.kravets@example.com", "2026-09-26T21:00:02Z")]),
    mockItem(3, "participant.open_registration.completed", "oksana.pavlenko@example.com", "2026-09-26T10:15:00Z", []),
];

function mockJournalPage(query: string): MailJournalPage {
    const params = new URLSearchParams(query);
    const channel = params.get("channel") || "email";
    const filtered = mockJournal.filter(item => {
        const target = journalTarget(item, channel);
        if (params.get("type") && item.NotificationType !== params.get("type")) return false;
        if (params.get("result") && target?.Status !== params.get("result")) return false;
        if (params.get("transport") && target?.Transport !== params.get("transport")) return false;
        return !!target || (!params.get("result") && !params.get("transport"));
    });
    const cursor = params.get("cursor");
    const limit = Number(params.get("limit") ?? mailJournalPageSize);
    const start = cursor ? Math.max(0, filtered.findIndex(item => item.ID === cursor) + 1) : 0;
    const items = filtered.slice(start, start + limit);
    return {Total: filtered.length, Items: items, NextCursor: filtered.length > start + limit ? items[items.length - 1].ID : undefined};
}

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 250));

// --- requests ---

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

// The contract does not pin the write responses: use the returned settings
// when they are the full EventMailSettings, otherwise re-read them.
async function savedSettings(eventID: string, data: unknown): Promise<EventMailSettings> {
    const parsed = settingsSchema.safeParse(data);
    return parsed.success ? parsed.data : getEventMailSettings(eventID);
}

const mocksEnabled = () => process.env.NEXT_PUBLIC_USE_MOCKS === "1";

export async function getEventMailSettings(eventID: string): Promise<EventMailSettings> {
    if (mocksEnabled()) {await mockDelay(); return mockSettings;}
    return request(eventID, "mail", settingsSchema);
}

export async function putEventMailSettings(eventID: string, input: MailSettingsInput): Promise<EventMailSettings> {
    if (mocksEnabled()) {
        await mockDelay();
        if (mailSettingsError({contactEmail: input.ContactEmail, startReminderHours: String(input.StartReminderHours)})) throw new ManageApiError(400, ApiErrorCode.MailSettingsInvalid);
        mockSettings = {...mockSettings, ...input, ReplyTo: input.ContactEmail || "support@cybericebox.com"};
        return mockSettings;
    }
    return savedSettings(eventID, await request(eventID, "mail", z.unknown().optional(), "PUT", input));
}

export async function putEventMailSMTP(eventID: string, input: SMTPInput): Promise<EventMailSettings> {
    if (mocksEnabled()) {
        await mockDelay();
        if (smtpError({host: input.Host, port: String(input.Port), tlsMode: input.TLSMode, username: input.Username, password: "", clearPassword: false})) throw new ManageApiError(400, ApiErrorCode.MailSMTPInvalid);
        mockStoredPassword = input.ClearPassword ? false : input.Password ? true : mockStoredPassword;
        mockSettings = {...mockSettings, SMTP: {Host: input.Host, Port: input.Port, TLSMode: input.TLSMode, Username: input.Username, PasswordSet: mockStoredPassword, UpdatedAt: new Date().toISOString()}};
        return mockSettings;
    }
    return savedSettings(eventID, await request(eventID, "mail/smtp", z.unknown().optional(), "PUT", input));
}

export async function deleteEventMailSMTP(eventID: string): Promise<EventMailSettings> {
    if (mocksEnabled()) {
        await mockDelay();
        mockStoredPassword = false;
        mockSettings = {...mockSettings, SMTP: null};
        return mockSettings;
    }
    return savedSettings(eventID, await request(eventID, "mail/smtp", z.unknown().optional(), "DELETE"));
}

// Tests the typed SMTP values, or the stored SMTP when `input` is null ({}).
export async function testEventMailSMTP(eventID: string, input: SMTPInput | null): Promise<MailTestResult> {
    if (mocksEnabled()) {
        await mockDelay();
        const host = input?.Host ?? mockSettings.SMTP?.Host ?? "";
        if (!host || host.includes("invalid")) return {Sent: false, Recipient: "manager@example.com", Transport: "event", Error: `dial tcp: lookup ${host || "smtp"}: no such host`};
        return {Sent: true, Recipient: "manager@example.com", Transport: "event", Error: ""};
    }
    return request(eventID, "mail/smtp/test", testResultSchema, "POST", input ?? {});
}

export async function getEventMailJournal(eventID: string, filters: MailJournalFilters, cursor: string | null): Promise<MailJournalPage> {
    const query = mailJournalQueryParams(filters, cursor).toString();
    if (mocksEnabled()) {await mockDelay(); return mockJournalPage(query);}
    return request(eventID, `mail/journal?${query}`, journalPageSchema);
}
