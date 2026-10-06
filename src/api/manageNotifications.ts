import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";

const id = z.string().uuid();
const signal = (type: string, group: string) => ({
    title: t(`manage.notifications.signal.${type}.title`),
    description: t(`manage.notifications.signal.${type}.description`),
    group: t(`manage.notifications.group.${group}`),
});
export const signalLabels: Record<string, {title: string; description: string; group: string}> = {
    "participant.approval_registration.submitted": signal("participant.approval_registration.submitted", "registration"),
    "participant.approval_registration.approved": signal("participant.approval_registration.approved", "registration"),
    "participant.approval_registration.rejected": signal("participant.approval_registration.rejected", "registration"),
    "participant.open_registration.completed": signal("participant.open_registration.completed", "registration"),
    "participant.invitation.sent": signal("participant.invitation.sent", "invitations"),
    "participant.invitation.accepted": signal("participant.invitation.accepted", "invitations"),
    "participant.invitation.revoked": signal("participant.invitation.revoked", "invitations"),
    "participant.invitation.expired": signal("participant.invitation.expired", "invitations"),
    "participant.team_invitation.sent": signal("participant.team_invitation.sent", "invitations"),
    "participant.event.start_reminder": signal("participant.event.start_reminder", "event"),
    "participant.event.finished": signal("participant.event.finished", "event"),
    "participant.event.results_published": signal("participant.event.results_published", "event"),
};

const otherGroup = t("manage.notifications.group.other");

// Label of a notification type; an unknown type falls back to its raw name.
export function signalLabel(signal: string): {title: string; description: string; group: string} {
    return signalLabels[signal] ?? {title: signal, description: "", group: otherGroup};
}

// Types shown on a channel page come from the subscription rows of that
// channel (the server omits rows that are never delivered), ordered like the
// label map; unknown types go last.
export function channelSignals(rows: {SignalType: string; Channel: string}[], channel: "in_app" | "email"): string[] {
    const known = Object.keys(signalLabels);
    const rank = (signal: string) => {const index = known.indexOf(signal); return index === -1 ? known.length : index;};
    return [...new Set(rows.filter(row => row.Channel === channel).map(row => row.SignalType))]
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function signalGroups(signals: string[]): {group: string; signals: string[]}[] {
    const groups: {group: string; signals: string[]}[] = [];
    for (const signal of signals) {
        const group = signalLabel(signal).group;
        const entry = groups.find(item => item.group === group);
        if (entry) entry.signals.push(signal);
        else groups.push({group, signals: [signal]});
    }
    return groups;
}

const audienceSchema = z.object({kind: z.string()}).passthrough();
const subscriptionSchema = z.object({
    SignalType: z.string(), Channel: z.enum(["in_app", "email"]), Enabled: z.boolean(),
    Audience: audienceSchema, Source: z.enum(["platform", "event"]), Required: z.boolean().default(false),
    // Per-signal options, e.g. days_before_start of the start reminder.
    Config: z.record(z.string(), z.unknown()).nullish().transform(config => config ?? {}),
});
const typeSchema = z.object({
    Type: z.string(), Channels: z.array(z.string()),
    Variables: z.array(z.object({Name: z.string(), Description: z.string(), Default: z.string()})),
});
const actionSchema = z.object({label: z.string(), href: z.string()});
const inAppTemplateSchema = z.object({
    ID: id, ScopeEventID: id.nullable(), NotificationType: z.string(), Status: z.enum(["draft", "published", "unpublished"]),
    Title: z.string(), Body: z.string(), Link: z.string(), Icon: z.string(), Tone: z.string(),
    AccentColor: z.string(), Surface: z.string(), AutoDismissMs: z.number().int().nullable(),
    Actions: z.array(actionSchema).nullable().transform(actions => actions ?? []), Dismissible: z.boolean(),
    PublishedAt: z.string().nullable(), UpdatedByUserID: id.nullable(), CreatedAt: z.string(), UpdatedAt: z.string(),
    Source: z.enum(["platform", "event"]),
});
export type ManageNotificationSubscription = z.infer<typeof subscriptionSchema>;
export type ManageNotificationType = z.infer<typeof typeSchema>;
export type ManageNotificationVariable = ManageNotificationType["Variables"][number];

// The start reminder is sent this many days before the event starts.
export const REMINDER_SIGNAL = "participant.event.start_reminder";
export const REMINDER_DEFAULT_DAYS = 7;
export const REMINDER_MIN_DAYS = 1;
export const REMINDER_MAX_DAYS = 30;

export function reminderDays(subscription: Pick<ManageNotificationSubscription, "Config"> | undefined): number {
    const value = subscription?.Config.days_before_start;
    return typeof value === "number" && Number.isInteger(value) ? value : REMINDER_DEFAULT_DAYS;
}

export function validReminderDays(days: number): boolean {
    return Number.isInteger(days) && days >= REMINDER_MIN_DAYS && days <= REMINDER_MAX_DAYS;
}
export type ManageInAppTemplate = z.infer<typeof inAppTemplateSchema>;
export type ManageInAppTemplateInput = Pick<ManageInAppTemplate, "NotificationType" | "Title" | "Body" | "Link" | "Icon" | "Tone" | "AccentColor" | "Surface" | "AutoDismissMs" | "Actions" | "Dismissible">;

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

export async function getManageNotificationSubscriptions(eventID: string): Promise<ManageNotificationSubscription[]> {
    return request(eventID, "notification-subscriptions", z.array(subscriptionSchema));
}

// Config is sent only when given: the server keeps the stored options otherwise.
export async function putManageNotificationSubscription(eventID: string, input: Pick<ManageNotificationSubscription, "SignalType" | "Channel" | "Enabled" | "Audience"> & {Config?: Record<string, unknown>}): Promise<ManageNotificationSubscription> {
    const body = {SignalType: input.SignalType, Channel: input.Channel, Enabled: input.Enabled, Audience: input.Audience, ...(input.Config ? {Config: input.Config} : {})};
    return request(eventID, "notification-subscriptions", subscriptionSchema, "PUT", body);
}

export async function getManageNotificationTypes(eventID: string): Promise<ManageNotificationType[]> {
    return request(eventID, "notification-types", z.array(typeSchema));
}

export async function resetManageNotificationSubscription(eventID: string, signalType: string, channel: "in_app" | "email"): Promise<void> {
    await request(eventID, `notification-subscriptions/${encodeURIComponent(signalType)}/${channel}`, z.unknown().optional(), "DELETE");
}

export async function getManageInAppTemplates(eventID: string): Promise<ManageInAppTemplate[]> {
    return request(eventID, "notification-templates/in-app", z.array(inAppTemplateSchema));
}

export async function createManageInAppTemplate(eventID: string, input: ManageInAppTemplateInput): Promise<ManageInAppTemplate> {
    return request(eventID, "notification-templates/in-app", inAppTemplateSchema, "POST", input);
}

export async function customizeManageInAppTemplate(eventID: string, template: ManageInAppTemplate): Promise<ManageInAppTemplate> {
    return request(eventID, `notification-templates/in-app/${template.ID}/customize`, inAppTemplateSchema, "POST");
}

export async function rollbackManageInAppTemplate(eventID: string, template: ManageInAppTemplate): Promise<ManageInAppTemplate> {
    return request(eventID, `notification-templates/in-app/${template.ID}/rollback`, inAppTemplateSchema, "POST");
}

export async function updateManageInAppTemplate(eventID: string, templateID: string, input: ManageInAppTemplateInput): Promise<ManageInAppTemplate> {
    return request(eventID, `notification-templates/in-app/${templateID}`, inAppTemplateSchema, "PUT", input);
}

export async function publishManageInAppTemplate(eventID: string, template: ManageInAppTemplate): Promise<ManageInAppTemplate> {
    return request(eventID, `notification-templates/in-app/${template.ID}/publish`, inAppTemplateSchema, "POST");
}

export async function resetManageInAppTemplate(eventID: string, notificationType: string): Promise<void> {
    await request(eventID, `notification-templates/in-app/type/${encodeURIComponent(notificationType)}`, z.unknown().optional(), "DELETE");
}
