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
    "participant.invitation.declined": {title: "Запрошення відхилено", description: "Учасник відхилив запрошення.", group: "Запрошення"},
    "participant.invitation.revoked": {title: "Запрошення скасовано", description: "Організатор скасував запрошення.", group: "Запрошення"},
    "participant.invitation.expired": {title: "Термін запрошення минув", description: "Запрошення більше не діє.", group: "Запрошення"},
    "participant.team_invitation.sent": {title: "Запрошення до команди", description: "Учасника запросили до команди.", group: "Запрошення"},
    "participant.enrolled": {title: "Участь підтверджено", description: "Учасника зараховано до події.", group: "Участь"},
};

const audienceSchema = z.object({kind: z.string()}).passthrough();
const subscriptionSchema = z.object({
    SignalType: z.string(), Channel: z.enum(["in_app", "email"]), Enabled: z.boolean(),
    Audience: audienceSchema, Source: z.enum(["platform", "event"]),
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

let mockSubscriptions = Object.keys(signalLabels).flatMap(signal => (["in_app", "email"] as const).map(channel => subscriptionSchema.parse({SignalType: signal, Channel: channel, Enabled: false, Audience: {kind: "signal_subject"}, Source: "platform"})));
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
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const value = subscriptionSchema.parse({...input, Source: "event"});
        mockSubscriptions = mockSubscriptions.map(item => item.SignalType === input.SignalType && item.Channel === input.Channel ? value : item);
        return value;
    }
    return request(eventID, "notification-subscriptions", subscriptionSchema, "PUT", input);
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
