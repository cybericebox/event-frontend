import {z} from "zod";
import {deriveTheme} from "@/components/event/manage/deriveTheme";
import {EventThemeSchema} from "@/types/eventTheme";
import {ContentDocumentSchema, ContentValueSchema, type ContentDocument} from "@/types/eventContent";
import {ContentVariableCatalogSchema} from "@/components/event/content/variableCatalog";

const themeSchema = EventThemeSchema;
const optionalLimit = z.number().int().positive().nullable();

export const ManageConfigSchema = z.object({
    EventID: z.string().uuid(),
    Participation: z.union([z.literal(0), z.literal(1), z.null()]),
    Registration: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    ScoreboardVisibility: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    ParticipantsVisibility: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    PreviewDescription: z.string(),
    PreviewPicture: z.string(),
    MaxTeamSize: z.number().int().positive(),
    MinTeamSize: optionalLimit,
    MaxTeams: optionalLimit,
    DynamicLabsPlanned: z.boolean(),
    Theme: themeSchema,
    UpdatedAt: z.string(),
});

export type ManageConfig = z.infer<typeof ManageConfigSchema>;
export type ManageConfigInput = Omit<ManageConfig, "EventID" | "Theme" | "UpdatedAt">;
export type ManageThemeInput = Pick<ManageConfig["Theme"], "Brand" | "Accent">;

export const ManageLifecycleSchema = z.object({
    Configured: z.boolean(),
    JoinPolicy: z.union([z.literal(0), z.literal(1)]),
    PublishAt: z.string().nullable(),
    StartAt: z.string().nullable(),
    FinishAt: z.string().nullable(),
    WithdrawAt: z.string().nullable(),
    Status: z.enum(["not_published", "published", "started", "finished", "withdrawn"]),
    UpdatedAt: z.string(),
    Infrastructure: z.object({HasDynamicLabs: z.boolean(), RequiresVPN: z.boolean(), CanStart: z.boolean(), Reason: z.string().nullable().optional()}),
});
export type ManageLifecycle = z.infer<typeof ManageLifecycleSchema>;
export type ManageLifecycleInput = Pick<ManageLifecycle, "JoinPolicy" | "PublishAt" | "StartAt" | "FinishAt" | "WithdrawAt">;

export const ManageContentSchema = z.object({
    Landing: ContentDocumentSchema,
    Live: z.unknown(),
    Variables: z.record(z.string(), ContentValueSchema),
});
export type ManageContent = z.infer<typeof ManageContentSchema>;
const ManagePageSchema = z.object({
    Slug: z.string(), Title: z.string(), Document: ContentDocumentSchema,
});

export class ManageApiError extends Error {
    constructor(readonly status: number) {
        super(`Event management request failed: ${status}`);
    }
}

const accessSchema = z.object({CanManage: z.boolean()});
const nameSchema = z.object({Name: z.string()});

let mockConfig: ManageConfig = {
    EventID: "01900000-0000-7000-8000-000000000001",
    Participation: null,
    Registration: 0,
    ScoreboardVisibility: 0,
    ParticipantsVisibility: 0,
    PreviewDescription: "",
    PreviewPicture: "",
    MaxTeamSize: 5,
    MinTeamSize: null,
    MaxTeams: null,
    DynamicLabsPlanned: false,
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
    UpdatedAt: "2026-09-26T00:00:00Z",
};
let mockName = "Winter Arena CTF";
let mockLifecycle: ManageLifecycle = {
    Configured: false, JoinPolicy: 0, PublishAt: null, StartAt: null, FinishAt: null, WithdrawAt: null,
    Status: "not_published", UpdatedAt: "2026-09-26T00:00:00Z",
    Infrastructure: {HasDynamicLabs: false, RequiresVPN: false, CanStart: true, Reason: null},
};
let mockContent: ManageContent = {
    Landing: {blocks: [
        {id: "intro", type: "section", label: "Про подію"},
        {id: "description", type: "text", markdown: "Командне змагання з кібербезпеки на CyberICEBox. Розв'язуйте завдання, співпрацюйте з командою та стежте за результатами."},
    ]},
    Live: {Profile: "scoreboard", Slots: {}},
    Variables: {"event.name": "Winter Arena CTF", "event.tag": "winter-arena-2026", "event.approvedTeamCount": 0, "event.approvedParticipantCount": 0, "event.isPublished": false},
};

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (path === "access") return schema.parse({CanManage: true});
        if (path === "name") {
            if (method === "PUT") mockName = (payload as {Name: string}).Name;
            return schema.parse({Name: mockName});
        }
        if (path === "config") {
            if (method === "PUT") mockConfig = {...mockConfig, ...(payload as ManageConfigInput)};
            return schema.parse(mockConfig);
        }
        if (path === "theme") {
            if (method === "PUT") {
                const input = payload as ManageThemeInput;
                const theme = deriveTheme(input.Brand, input.Accent, mockConfig.Theme.Version + 1);
                if (!theme) throw new ManageApiError(400);
                mockConfig = {...mockConfig, Theme: theme};
            }
            return schema.parse(mockConfig);
        }
        if (path === "lifecycle") {
            if (method === "PUT") {
                const input = payload as ManageLifecycleInput;
                const now = Date.now();
                const status = input.WithdrawAt && Date.parse(input.WithdrawAt) <= now ? "withdrawn"
                    : input.PublishAt && Date.parse(input.PublishAt) > now ? "not_published"
                    : input.StartAt && Date.parse(input.StartAt) > now ? "published"
                    : input.FinishAt && Date.parse(input.FinishAt) <= now ? "finished" : "started";
                mockLifecycle = {...mockLifecycle, ...input, Configured: true, Status: status, UpdatedAt: new Date().toISOString()};
            }
            return schema.parse(mockLifecycle);
        }
        if (path === "content") return schema.parse(mockContent);
        if (path === "content/variables") return schema.parse([
            {name: "event.name", label: "Назва події", format: "text", audience: 0},
            {name: "event.startAt", label: "Час початку", format: "date-time", audience: 0},
            {name: "event.isStarted", label: "Розпочато", format: "boolean", audience: 0},
            {name: "event.approvedTeamCount", label: "Схвалені команди", format: "number", audience: 0},
            {name: "event.publishAt", label: "Час публікації", format: "date-time", audience: 2},
        ]);
        if (path.startsWith("pages/")) return schema.parse({
            Slug: decodeURIComponent(path.slice(6)), Title: "Питання та відповіді",
            Document: {blocks: [{id: "sample", type: "text", markdown: "Вміст цієї сторінки налаштовується організаторами події."}]},
        });
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    const envelope = z.object({Data: schema}).parse(await response.json());
    return envelope.Data;
}

export const getManageAccess = (eventID: string) => request(eventID, "access", accessSchema);
export const getManageName = (eventID: string) => request(eventID, "name", nameSchema);
export const putManageName = (eventID: string, name: string) => request(eventID, "name", nameSchema, "PUT", {Name: name});
export const getManageConfig = (eventID: string) => request(eventID, "config", ManageConfigSchema);
export const putManageConfig = (eventID: string, config: ManageConfigInput) => request(eventID, "config", ManageConfigSchema, "PUT", config);
export const putManageTheme = (eventID: string, theme: ManageThemeInput) => request(eventID, "theme", ManageConfigSchema, "PUT", theme);
export const getManageLifecycle = (eventID: string) => request(eventID, "lifecycle", ManageLifecycleSchema);
export const putManageLifecycle = (eventID: string, input: ManageLifecycleInput) => request(eventID, "lifecycle", ManageLifecycleSchema, "PUT", input);
export const getManageContent = (eventID: string) => request(eventID, "content", ManageContentSchema);
export const getManageContentVariables = (eventID: string) => request(eventID, "content/variables", ContentVariableCatalogSchema);
export const getManagePage = (eventID: string, slug: string) => request(eventID, `pages/${encodeURIComponent(slug)}`, ManagePageSchema);

export async function putManageLanding(eventID: string, document: ContentDocument): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockContent = {...mockContent, Landing: ContentDocumentSchema.parse(document)};
        return;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/content/landing`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Document: document}),
    });
    if (!response.ok) throw new ManageApiError(response.status);
}
