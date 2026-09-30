import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";
import {parseNumberInput} from "@/components/ui/EventNumberInput";

// W7 «Пошта»: event sender and reply-to identity, start reminder,
// optional event SMTP and the delivery journal (spec 2026-09-29 §6).

export type MailTLSMode = "starttls" | "tls";
// An event knows two routes: its own SMTP and the platform. The server-config
// fallback is not an event concept: the backend reports it as the platform.
export type MailTransport = "event" | "platform";
export type MailResult = "done" | "error" | "deferred";

export const tlsModeOptions: {value: MailTLSMode; label: string}[] = [
    {value: "starttls", label: "STARTTLS (587)"},
    {value: "tls", label: "TLS (465)"},
];
export const defaultPortByTLSMode: Record<MailTLSMode, number> = {starttls: 587, tls: 465};
export const mailTransportLabels: Record<MailTransport, string> = {event: t("manage.mail.transport.event"), platform: t("manage.mail.transport.platform")};
export const mailResultLabels: Record<MailResult, string> = {done: t("manage.mail.result.done"), error: t("manage.mail.result.error"), deferred: t("manage.mail.result.deferred")};

export function mailTransportLabel(value: string): string {
    if (value === "env") return mailTransportLabels.platform;
    return mailTransportLabels[value as MailTransport] ?? (value || "—");
}

const smtpSchema = z.object({
    Host: z.string(), Port: z.number().int(), TLSMode: z.string(), Username: z.string(),
    PasswordSet: z.boolean(), UpdatedAt: z.string().nullable().optional(),
    // Saved send limits of this SMTP; null = not set.
    MaxPerSecond: z.number().nullish().transform(value => value ?? null),
    DailyQuota: z.number().int().nullish().transform(value => value ?? null),
});
// The limits in effect for the event's own SMTP (saved, else none) and the
// messages it delivered in the last 24 hours.
const limitsSchema = z.object({
    PerSecond: z.number().default(0), DailyQuota: z.number().int().default(0),
    PerSecondSource: z.enum(["saved", "env", "none"]).catch("none"), DailyQuotaSource: z.enum(["saved", "env", "none"]).catch("none"),
    Used24h: z.number().int().default(0),
});
const partySchema = z.object({Name: z.string().nullable().transform(value => value ?? ""), Address: z.string().nullable().transform(value => value ?? "")});
const identitySchema = z.object({Sender: partySchema, ReplyTo: partySchema});
export type MailFieldSource = "event" | "derived" | "platform" | "default" | "none";
const sourceSchema = z.enum(["event", "derived", "platform", "default", "none"]).catch("none");
const inheritedSourcesSchema = z.object({
    SenderName: sourceSchema, SenderAddress: sourceSchema, ReplyToName: sourceSchema, ReplyToAddress: sourceSchema,
});
const settingsSchema = z.object({
    Identity: identitySchema,
    // What applies where the event leaves a field empty, with where each value comes from.
    Inherited: identitySchema,
    InheritedSources: inheritedSourcesSchema.default({SenderName: "none", SenderAddress: "none", ReplyToName: "none", ReplyToAddress: "none"}),
    SMTP: smtpSchema.nullable(),
    PlatformConfigured: z.boolean(),
    Limits: limitsSchema.default({PerSecond: 0, DailyQuota: 0, PerSecondSource: "none", DailyQuotaSource: "none", Used24h: 0}),
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
    // Set when the message is one recipient of a custom broadcast («Розсилка»).
    BroadcastID: z.string().nullish(),
    RecipientEmail: z.string().nullable().optional().transform(value => value ?? ""),
    Targets: z.array(targetSchema).nullable().optional().transform(value => value ?? []),
});
const journalPageSchema = z.object({
    Total: z.number().int(), Items: z.array(journalItemSchema), NextCursor: z.string().nullable().optional(),
});

export type MailParty = z.infer<typeof partySchema>;
// A send-limit tooltip: what the field is, then whether a limit is saved.
export function withLimitSource(help: string, source: "saved" | "env" | "none"): string {
    return `${help} ${t(`manage.mail.limitSource.${source === "env" ? "none" : source}`)}`;
}

// A field tooltip: what the field is, then where the placeholder value comes from.
export function withSource(help: string, source: MailFieldSource): string {
    return `${help} ${t(`manage.mail.fieldSource.${source}`)}`;
}

export type MailIdentity = z.infer<typeof identitySchema>;
export type EventMailSettings = z.infer<typeof settingsSchema>;
export type EventMailSMTP = z.infer<typeof smtpSchema>;
export type MailTestResult = z.infer<typeof testResultSchema>;
export type MailJournalTarget = z.infer<typeof targetSchema>;
export type MailJournalItem = z.infer<typeof journalItemSchema>;
export type MailJournalPage = z.infer<typeof journalPageSchema>;

// --- form state and payload builders ---

export type IdentityForm = {senderName: string; senderAddress: string; replyToName: string; replyToAddress: string};
export type IdentityInput = {Sender: MailParty; ReplyTo: MailParty};

export const maxMailNameLength = 64;
export type IdentityError = "" | "senderName" | "senderAddress" | "replyToName" | "replyToAddress";

export function identityForm(identity: MailIdentity): IdentityForm {
    return {senderName: identity.Sender.Name, senderAddress: identity.Sender.Address, replyToName: identity.ReplyTo.Name, replyToAddress: identity.ReplyTo.Address};
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The first invalid field, or "" when the form can be saved. Empty fields
// inherit the platform values, so they are always valid.
export function identityError(form: IdentityForm): IdentityError {
    if (form.senderName.trim().length > maxMailNameLength) return "senderName";
    const sender = form.senderAddress.trim();
    if (sender && !emailPattern.test(sender)) return "senderAddress";
    if (form.replyToName.trim().length > maxMailNameLength) return "replyToName";
    const reply = form.replyToAddress.trim();
    if (reply && !emailPattern.test(reply)) return "replyToAddress";
    return "";
}

export function identityInput(form: IdentityForm): IdentityInput {
    return {
        Sender: {Name: form.senderName.trim(), Address: form.senderAddress.trim()},
        ReplyTo: {Name: form.replyToName.trim(), Address: form.replyToAddress.trim()},
    };
}

export type SMTPForm = {host: string; port: string; tlsMode: MailTLSMode; username: string; password: string; clearPassword: boolean; maxPerSecond: string; dailyQuota: string};
export type SMTPInput = {Host: string; Port: number; TLSMode: MailTLSMode; Username: string; Password: string; ClearPassword: boolean; MaxPerSecond: number | null; DailyQuota: number | null};

export function smtpForm(smtp: EventMailSMTP | null): SMTPForm {
    const tlsMode: MailTLSMode = smtp?.TLSMode === "tls" ? "tls" : "starttls";
    return {host: smtp?.Host ?? "", port: smtp ? String(smtp.Port) : String(defaultPortByTLSMode[tlsMode]), tlsMode, username: smtp?.Username ?? "", password: "", clearPassword: false,
        maxPerSecond: smtp?.MaxPerSecond != null ? String(smtp.MaxPerSecond) : "", dailyQuota: smtp?.DailyQuota != null ? String(smtp.DailyQuota) : ""};
}

export function smtpError(form: SMTPForm): string {
    if (!form.host.trim()) return t("manage.mail.validation.hostRequired");
    if (/\s/.test(form.host.trim())) return t("manage.mail.validation.hostSpaces");
    const port = form.port.trim();
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) return t("manage.mail.validation.port");
    if (Number.isNaN(parseNumberInput(form.maxPerSecond))) return t("manage.mail.validation.maxPerSecond");
    if (Number.isNaN(parseNumberInput(form.dailyQuota, true))) return t("manage.mail.validation.dailyQuota");
    return "";
}

// Empty Password keeps the stored one; ClearPassword removes it and wins over
// a typed password (the explicit «Видалити пароль» action).
export function smtpInput(form: SMTPForm): SMTPInput {
    return {
        Host: form.host.trim(), Port: Number(form.port.trim()), TLSMode: form.tlsMode, Username: form.username.trim(),
        Password: form.clearPassword ? "" : form.password, ClearPassword: form.clearPassword,
        MaxPerSecond: parseNumberInput(form.maxPerSecond), DailyQuota: parseNumberInput(form.dailyQuota, true),
    };
}

export type MailJournalFilters = {type: string | null; status: string | null; result: MailResult | null; transport: MailTransport | null; channel: string};
export const emptyMailJournalFilters: MailJournalFilters = {type: null, status: null, result: null, transport: null, channel: "email"};
// Journal kind of an SMTP test send from the mail settings (not a signal type).
export const mailTestType = "smtp_test";
// Journal kind of a custom broadcast message.
export const mailBroadcastType = "broadcast";

// Label of a journal row type: the SMTP test kind, else the signal label.
export function mailJournalTypeLabel(type: string, signalTitle: (type: string) => string): string {
    if (type === mailBroadcastType) return t("manage.broadcasts.journalType");
    return type === mailTestType ? t("manage.mail.journal.smtpTest") : signalTitle(type);
}

// Type filter values: the signal types plus the SMTP test kind.
export function mailJournalTypes(signalTypes: string[]): string[] {
    const withTest = signalTypes.includes(mailTestType) ? signalTypes : [...signalTypes, mailTestType];
    return withTest.includes(mailBroadcastType) ? withTest : [...withTest, mailBroadcastType];
}

// Delivery result of a journal target: sent, failed or waiting for a send limit.
export function targetResult(target: MailJournalTarget | null): MailResult | null {
    return target?.Status === "done" || target?.Status === "error" || target?.Status === "deferred" ? target.Status : null;
}

export const mailDispatchStatuses = ["pending", "started", "done", "error"] as const;
export const mailJournalPageSize = 25;

export function mailJournalQueryParams(filters: MailJournalFilters, cursor: string | null = null, limit = mailJournalPageSize): URLSearchParams {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (filters.channel) params.set("channel", filters.channel);
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);
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

export async function putEventMailIdentity(eventID: string, input: IdentityInput): Promise<EventMailSettings> {
    return savedSettings(eventID, await request(eventID, "mail/identity", z.unknown().optional(), "PUT", input));
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

export async function getEventMailJournal(eventID: string, filters: MailJournalFilters, cursor: string | null, limit = mailJournalPageSize): Promise<MailJournalPage> {
    const query = mailJournalQueryParams(filters, cursor, limit).toString();
    return request(eventID, `mail/journal?${query}`, journalPageSchema);
}
