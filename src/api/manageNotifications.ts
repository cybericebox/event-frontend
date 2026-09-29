import {z} from "zod";
import {ManageApiError} from "@/api/manage";

const id = z.string().uuid();
export const signalLabels: Record<string, {title: string; description: string; group: string}> = {
    "participant.approval_registration.submitted": {title: "Заявку подано", description: "Учасник надіслав заявку на участь.", group: "Реєстрація"},
    "participant.approval_registration.approved": {title: "Заявку схвалено", description: "Організатор підтвердив заявку.", group: "Реєстрація"},
    "participant.approval_registration.rejected": {title: "Заявку відхилено", description: "Організатор відхилив заявку.", group: "Реєстрація"},
    "participant.open_registration.completed": {title: "Реєстрацію завершено", description: "Учасник приєднався через відкриту реєстрацію.", group: "Реєстрація"},
    "participant.invitation.sent": {title: "Запрошення надіслано", description: "Учасник отримав запрошення до події.", group: "Запрошення"},
    "participant.invitation.accepted": {title: "Запрошення прийнято", description: "Учасник прийняв запрошення.", group: "Запрошення"},
    "participant.invitation.revoked": {title: "Запрошення скасовано", description: "Організатор скасував запрошення.", group: "Запрошення"},
    "participant.invitation.expired": {title: "Термін запрошення минув", description: "Запрошення більше не діє.", group: "Запрошення"},
    "participant.team_invitation.sent": {title: "Запрошення до команди", description: "Учасника запросили до команди.", group: "Запрошення"},
    "participant.event.start_reminder": {title: "Нагадування про старт", description: "Учасники отримують нагадування перед початком події.", group: "Подія"},
    "participant.event.finished": {title: "Захід завершено", description: "Учасники дізнаються, що подія завершилася.", group: "Подія"},
};

const otherGroup = "Інше";

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

// Invitation emails are always sent (M3): their rows carry Required and no toggle.
const requiredEmailSignals = new Set(["participant.invitation.sent", "participant.team_invitation.sent"]);

const audienceSchema = z.object({kind: z.string()}).passthrough();
const subscriptionSchema = z.object({
    SignalType: z.string(), Channel: z.enum(["in_app", "email"]), Enabled: z.boolean(),
    Audience: audienceSchema, Source: z.enum(["platform", "event"]), Required: z.boolean().default(false),
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
export type ManageInAppTemplate = z.infer<typeof inAppTemplateSchema>;
export type ManageInAppTemplateInput = Pick<ManageInAppTemplate, "NotificationType" | "Title" | "Body" | "Link" | "Icon" | "Tone" | "AccentColor" | "Surface" | "AutoDismissMs" | "Actions" | "Dismissible">;

let mockSubscriptions = Object.keys(signalLabels).flatMap(signal => (["in_app", "email"] as const)
    .filter(channel => channel === "email" || !requiredEmailSignals.has(signal))
    .map(channel => {
        const required = channel === "email" && requiredEmailSignals.has(signal);
        return subscriptionSchema.parse({SignalType: signal, Channel: channel, Enabled: required, Audience: {kind: signal.startsWith("participant.event.") ? "all_participants" : "signal_subject"}, Source: "platform", Required: required});
    }));
let mockTemplates = Object.entries(signalLabels).map(([signal, label], index) => inAppTemplateSchema.parse({
    ID: `01900000-0000-7000-8001-${String(index + 1).padStart(12, "0")}`, ScopeEventID: null,
    NotificationType: signal, Status: "published", Title: label.title,
    Body: `${label.description} Захід «{{.event_name}}».`, Link: "", Icon: "mail", Tone: "info", AccentColor: "",
    Surface: "inbox", AutoDismissMs: 5000, Actions: [], Dismissible: true,
    PublishedAt: "2026-09-26T08:00:00Z", UpdatedByUserID: null,
    CreatedAt: "2026-09-26T08:00:00Z", UpdatedAt: "2026-09-26T08:00:00Z", Source: "platform",
}));

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageNotificationSubscriptions(eventID: string): Promise<ManageNotificationSubscription[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockSubscriptions;
    return request(eventID, "notification-subscriptions", z.array(subscriptionSchema));
}

export async function putManageNotificationSubscription(eventID: string, input: Pick<ManageNotificationSubscription, "SignalType" | "Channel" | "Enabled" | "Audience">): Promise<ManageNotificationSubscription> {
    const body = {SignalType: input.SignalType, Channel: input.Channel, Enabled: input.Enabled, Audience: input.Audience};
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (mockSubscriptions.some(item => item.SignalType === input.SignalType && item.Channel === input.Channel && item.Required)) throw new ManageApiError(409, 2103);
        const value = subscriptionSchema.parse({...body, Source: "event"});
        mockSubscriptions = mockSubscriptions.map(item => item.SignalType === input.SignalType && item.Channel === input.Channel ? value : item);
        return value;
    }
    return request(eventID, "notification-subscriptions", subscriptionSchema, "PUT", body);
}

export async function resetManageNotificationSubscription(eventID: string, signalType: string, channel: "in_app" | "email"): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockSubscriptions = mockSubscriptions.map(item => item.SignalType === signalType && item.Channel === channel ? {...item, Enabled: false, Source: "platform"} : item);
        return;
    }
    await request(eventID, `notification-subscriptions/${encodeURIComponent(signalType)}/${channel}`, z.unknown().optional(), "DELETE");
}

export async function getManageInAppTemplates(eventID: string): Promise<ManageInAppTemplate[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const overridden = new Set(mockTemplates.filter(item => item.Source === "event").map(item => item.NotificationType));
        return mockTemplates.filter(item => item.Source === "event" || !overridden.has(item.NotificationType));
    }
    return request(eventID, "notification-templates/in-app", z.array(inAppTemplateSchema));
}

export async function createManageInAppTemplate(eventID: string, input: ManageInAppTemplateInput): Promise<ManageInAppTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const now = new Date().toISOString();
        const value = inAppTemplateSchema.parse({
            ...input, ID: crypto.randomUUID(), ScopeEventID: eventID, Status: "draft", Source: "event",
            PublishedAt: null, UpdatedByUserID: null, CreatedAt: now, UpdatedAt: now,
        });
        mockTemplates = [...mockTemplates, value];
        return value;
    }
    return request(eventID, "notification-templates/in-app", inAppTemplateSchema, "POST", input);
}

function mockTemplateMutation(eventID: string, template: ManageInAppTemplate, status: ManageInAppTemplate["Status"]): ManageInAppTemplate {
    const now = new Date().toISOString();
    const value = inAppTemplateSchema.parse({...template, ID: crypto.randomUUID(), ScopeEventID: eventID, Source: "event", Status: status, PublishedAt: status === "published" ? now : null, UpdatedAt: now});
    mockTemplates = [...mockTemplates, value];
    return value;
}

export async function customizeManageInAppTemplate(eventID: string, template: ManageInAppTemplate): Promise<ManageInAppTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockTemplateMutation(eventID, template, "draft");
    return request(eventID, `notification-templates/in-app/${template.ID}/customize`, inAppTemplateSchema, "POST");
}

export async function rollbackManageInAppTemplate(eventID: string, template: ManageInAppTemplate): Promise<ManageInAppTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockTemplateMutation(eventID, template, "draft");
    return request(eventID, `notification-templates/in-app/${template.ID}/rollback`, inAppTemplateSchema, "POST");
}

export async function updateManageInAppTemplate(eventID: string, templateID: string, input: ManageInAppTemplateInput): Promise<ManageInAppTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const current = mockTemplates.find(item => item.ID === templateID);
        if (!current) throw new ManageApiError(404);
        const value = inAppTemplateSchema.parse({...current, ...input, UpdatedAt: new Date().toISOString()});
        mockTemplates = mockTemplates.map(item => item.ID === templateID ? value : item);
        return value;
    }
    return request(eventID, `notification-templates/in-app/${templateID}`, inAppTemplateSchema, "PUT", input);
}

export async function publishManageInAppTemplate(eventID: string, template: ManageInAppTemplate): Promise<ManageInAppTemplate> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const now = new Date().toISOString();
        const value = inAppTemplateSchema.parse({...template, Status: "published", PublishedAt: now, UpdatedAt: now});
        mockTemplates = mockTemplates.map(item => item.ID === template.ID ? value : item.Status === "published" && item.NotificationType === template.NotificationType && item.Source === "event" ? {...item, Status: "unpublished"} : item);
        return value;
    }
    return request(eventID, `notification-templates/in-app/${template.ID}/publish`, inAppTemplateSchema, "POST");
}

export async function resetManageInAppTemplate(eventID: string, notificationType: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockTemplates = mockTemplates.filter(item => item.NotificationType !== notificationType || item.Source === "platform");
        return;
    }
    await request(eventID, `notification-templates/in-app/type/${encodeURIComponent(notificationType)}`, z.unknown().optional(), "DELETE");
}
