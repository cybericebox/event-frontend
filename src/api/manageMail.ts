import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";

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

// --- requests ---

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
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

export async function getEventMailSettings(eventID: string): Promise<EventMailSettings> {
    return request(eventID, "mail", settingsSchema);
}

export async function putEventMailSettings(eventID: string, input: MailSettingsInput): Promise<EventMailSettings> {
    return savedSettings(eventID, await request(eventID, "mail", z.unknown().optional(), "PUT", input));
}

export async function putEventMailSMTP(eventID: string, input: SMTPInput): Promise<EventMailSettings> {
    return savedSettings(eventID, await request(eventID, "mail/smtp", z.unknown().optional(), "PUT", input));
}

export async function deleteEventMailSMTP(eventID: string): Promise<EventMailSettings> {
    return savedSettings(eventID, await request(eventID, "mail/smtp", z.unknown().optional(), "DELETE"));
}

// Tests the typed SMTP values, or the stored SMTP when `input` is null ({}).
export async function testEventMailSMTP(eventID: string, input: SMTPInput | null): Promise<MailTestResult> {
    return request(eventID, "mail/smtp/test", testResultSchema, "POST", input ?? {});
}

export async function getEventMailJournal(eventID: string, filters: MailJournalFilters, cursor: string | null): Promise<MailJournalPage> {
    const query = mailJournalQueryParams(filters, cursor).toString();
    return request(eventID, `mail/journal?${query}`, journalPageSchema);
}
