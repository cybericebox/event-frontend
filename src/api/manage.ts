import {plainTextRichText} from "@/components/event/content/richTextState";
import {z} from "zod";
import {readApiErrorCode} from "@/api/apiErrors";
import {deriveTheme} from "@/components/event/manage/deriveTheme";
import {EventThemeSchema} from "@/types/eventTheme";
import {ContentDocumentSchema, ContentValueSchema, type ContentDocument} from "@/types/eventContent";
import {defaultMockLanding, readMockLanding, readMockLandingDraft, writeMockLanding, writeMockLandingDraft} from "@/api/mockLanding";
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
    // Admin-owned at event creation; read-only for moderators.
    InfrastructureAllowed: z.boolean().default(false),
    AllowPseudonyms: z.boolean().default(false),
    ShowDifficulty: z.boolean().default(true),
    ShowHints: z.boolean().default(true),
    // reward (default): unlocked hints reduce the solve's reward; balance: charged at unlock.
    HintChargeMode: z.enum(["reward", "balance"]).catch("reward"),
    Theme: themeSchema,
    UpdatedAt: z.string(),
});

export type ManageConfig = z.infer<typeof ManageConfigSchema>;
export type ManageConfigInput = Omit<ManageConfig, "EventID" | "Theme" | "UpdatedAt" | "InfrastructureAllowed">;

// Every config PUT sends the full input so no setting is silently reset.
export function manageConfigInput(config: ManageConfig): ManageConfigInput {
    return {
        Participation: config.Participation, Registration: config.Registration,
        ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility,
        PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture,
        MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams,
        AllowPseudonyms: config.AllowPseudonyms,
        ShowDifficulty: config.ShowDifficulty, ShowHints: config.ShowHints, HintChargeMode: config.HintChargeMode,
    };
}
export type ManageThemeInput = Pick<ManageConfig["Theme"], "Brand" | "Accent">;
export type BrandAssetChange = {Action: "keep" | "remove" | "replace"; FileID?: string};
export type ManageGeneralInput = {Name: string; Description: string; Preview: BrandAssetChange};
export type ManageAppearanceInput = ManageThemeInput & {Logo: BrandAssetChange; Favicon: BrandAssetChange};

export const ManageLifecycleSchema = z.object({
    Configured: z.boolean(),
    JoinPolicy: z.union([z.literal(0), z.literal(1)]),
    PublishAt: z.string().nullable(),
    StartAt: z.string().nullable(),
    FinishAt: z.string().nullable(),
    WithdrawAt: z.string().nullable(),
    Status: z.enum(["not_published", "published", "started", "finished", "withdrawn"]),
    UpdatedAt: z.string(),
    Infrastructure: z.object({HasDynamicLabs: z.boolean(), LaboratoriesAvailable: z.boolean(), RequiresVPN: z.boolean(), CanStart: z.boolean(), Reason: z.string().nullable().optional()}),
});
export type ManageLifecycle = z.infer<typeof ManageLifecycleSchema>;
export type ManageLifecycleInput = Pick<ManageLifecycle, "JoinPolicy" | "PublishAt" | "StartAt" | "FinishAt" | "WithdrawAt">;

export const ManageScoringSchema = z.object({
    Mode: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    MinPoints: z.number().int(), MaxPoints: z.number().int(), FloorAtPercent: z.number().int(),
    ForceEventScoring: z.boolean(), UpdatedAt: z.string(),
});
export type ManageScoring = z.infer<typeof ManageScoringSchema>;
export type ManageScoringInput = Omit<ManageScoring, "UpdatedAt">;

export const ManageContentSchema = z.object({
    Landing: ContentDocumentSchema,
    // Saved but unpublished landing; the site keeps showing Landing.
    LandingDraft: ContentDocumentSchema.nullable().default(null),
    Live: z.unknown(),
    Variables: z.record(z.string(), ContentValueSchema),
});
export type ManageContent = z.infer<typeof ManageContentSchema>;
const PageVisibilitySchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
// The event site has one menu: a page is in the navbar (1) or nowhere (0).
const PageNavigationSchema = z.union([z.literal(0), z.literal(1)]);
// "first" | "challenges" | "results" | page ID | "" (keep the current place).
export const ManagePageDraftSchema = z.object({
    Slug: z.string(), Title: z.string(), Document: ContentDocumentSchema,
    Visibility: PageVisibilitySchema, Navigation: PageNavigationSchema, NavigationAfter: z.string().default(""),
});
// Top-level fields are the published version (a never-published page shows its
// current content and PublishedAt null); Draft holds unpublished changes.
export const ManagePageSchema = z.object({
    ID: z.string().uuid(), Slug: z.string(), Title: z.string(), Document: ContentDocumentSchema,
    Visibility: PageVisibilitySchema,
    Navigation: PageNavigationSchema,
    NavigationOrder: z.number().int(),
    Draft: ManagePageDraftSchema.nullable().default(null),
    PublishedAt: z.string().nullable().default(null),
});
export type ManagePage = z.infer<typeof ManagePageSchema>;
export type ManagePageInput = z.infer<typeof ManagePageDraftSchema>;

// The editor works on the draft when there is one, otherwise on the published page.
export function editablePage(page: ManagePage): ManagePageInput {
    return page.Draft ?? {Slug: page.Slug, Title: page.Title, Document: page.Document, Visibility: page.Visibility, Navigation: page.Navigation, NavigationAfter: ""};
}

export class ManageApiError extends Error {
    constructor(readonly status: number, readonly code?: number) {
        super(`Event management request failed: ${status}`);
    }
}

export async function manageApiError(response: Response): Promise<ManageApiError> {
    return new ManageApiError(response.status, await readApiErrorCode(response));
}

// InfrastructureAllowed is the admin's creation-time decision; it gates «Стенди».
const accessSchema = z.object({CanManage: z.boolean(), InfrastructureAllowed: z.boolean().default(false)});
const nameSchema = z.object({Name: z.string()});

let mockConfig: ManageConfig = {
    EventID: "01900000-0000-7000-8000-000000000001",
    Participation: null,
    Registration: 0,
    ScoreboardVisibility: 0,
    ParticipantsVisibility: 0,
    PreviewDescription: "",
    PreviewPicture: "/assets/background.png",
    MaxTeamSize: 5,
    MinTeamSize: null,
    MaxTeams: null,
    InfrastructureAllowed: false,
    AllowPseudonyms: false,
    ShowDifficulty: true,
    ShowHints: true,
    HintChargeMode: "reward",
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
    UpdatedAt: "2026-09-26T00:00:00Z",
};
let mockName = "Winter Arena CTF";
const mockBrandDrafts = new Map<string, string>();
let mockLogoURL = "";
let mockFaviconURL = "";
let mockLifecycle: ManageLifecycle = {
    Configured: false, JoinPolicy: 0, PublishAt: null, StartAt: null, FinishAt: null, WithdrawAt: null,
    Status: "not_published", UpdatedAt: "2026-09-26T00:00:00Z",
    Infrastructure: {HasDynamicLabs: false, LaboratoriesAvailable: false, RequiresVPN: false, CanStart: true, Reason: null},
};
let mockScoring: ManageScoring = {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0, ForceEventScoring: false, UpdatedAt: "2026-09-26T00:00:00Z"};
let mockContent: ManageContent = {
    Landing: defaultMockLanding,
    LandingDraft: null,
    Live: {Profile: "scoreboard", Slots: {}},
    Variables: {"event.name": "Winter Arena CTF", "event.tag": "winter-arena-2026", "event.finishAt": new Date(Date.now() + 18 * 3_600_000).toISOString(), "event.approvedTeamCount": 0, "event.approvedParticipantCount": 0, "event.isPublished": false},
};
let mockPages: ManagePage[] = [{
    ID: "01900000-0000-7000-8000-000000000002", Slug: "faq", Title: "Питання та відповіді",
    Document: {blocks: [{id: "sample", type: "text", richText: plainTextRichText("Вміст цієї сторінки налаштовується організаторами події.")}]},
    Visibility: 0, Navigation: 1, NavigationOrder: 1, Draft: null, PublishedAt: "2026-09-26T00:00:00Z",
}];

// Mirrors eventContentModel.PlaceInNavigation for mock mode.
function mockPublishPage(page: ManagePage): ManagePage {
    const draft = page.Draft ?? editablePage(page);
    const group = (order: number) => order < -500_000_000 ? 0 : order < 0 ? 1 : 2;
    const current = mockPages.filter(item => item.PublishedAt && item.Navigation === 1).sort((a, b) => a.NavigationOrder - b.NavigationOrder || a.Slug.localeCompare(b.Slug));
    const oldIndex = current.findIndex(item => item.ID === page.ID);
    const entries = current.filter(item => item.ID !== page.ID).map(item => ({id: item.ID, group: group(item.NavigationOrder)}));
    if (draft.Navigation === 1) {
        const after = (limit: number) => entries.filter(item => item.group <= limit).length;
        const target = entries.findIndex(item => item.id === draft.NavigationAfter);
        const [index, placed] = draft.NavigationAfter === "first" ? [0, 0] : draft.NavigationAfter === "challenges" ? [after(0), 1] : draft.NavigationAfter === "results" ? [after(1), 2]
            : target >= 0 ? [target + 1, entries[target].group] : oldIndex >= 0 ? [oldIndex, group(page.NavigationOrder)] : [entries.length, 2];
        entries.splice(index, 0, {id: page.ID, group: placed});
    }
    const challenges = entries.filter(item => item.group === 0).length;
    const results = entries.filter(item => item.group < 2).length;
    const orders = new Map(entries.map((item, position) => [item.id, position < challenges ? position - 1_000_000_000 : position - results]));
    mockPages = mockPages.map(item => orders.has(item.ID) && item.ID !== page.ID ? {...item, NavigationOrder: orders.get(item.ID)!} : item);
    const published: ManagePage = {...page, Slug: draft.Slug, Title: draft.Title, Document: draft.Document, Visibility: draft.Visibility, Navigation: draft.Navigation,
        NavigationOrder: orders.get(page.ID) ?? page.NavigationOrder, Draft: null, PublishedAt: new Date().toISOString()};
    mockPages = mockPages.map(item => item.ID === page.ID ? published : item);
    return published;
}

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (path === "access") return schema.parse({CanManage: true, InfrastructureAllowed: true});
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
        if (path === "general" && method === "PUT") {
            const input = payload as ManageGeneralInput;
            mockName = input.Name;
            mockConfig = {...mockConfig, PreviewDescription: input.Description, PreviewPicture: input.Preview.Action === "replace" ? mockBrandDrafts.get(input.Preview.FileID ?? "") ?? "" : input.Preview.Action === "remove" ? "" : mockConfig.PreviewPicture};
            return schema.parse({Name: mockName, Config: mockConfig});
        }
        if (path === "appearance" && method === "PUT") {
            const input = payload as ManageAppearanceInput;
            const theme = deriveTheme(input.Brand, input.Accent, mockConfig.Theme.Version + 1);
            if (!theme) throw new ManageApiError(400);
            mockConfig = {...mockConfig, Theme: theme};
            if (input.Logo.Action !== "keep") mockLogoURL = input.Logo.Action === "remove" ? "" : mockBrandDrafts.get(input.Logo.FileID ?? "") ?? "";
            if (input.Favicon.Action !== "keep") mockFaviconURL = input.Favicon.Action === "remove" ? "" : mockBrandDrafts.get(input.Favicon.FileID ?? "") ?? "";
            return schema.parse({Config: mockConfig, LogoURL: mockLogoURL, FaviconURL: mockFaviconURL});
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
        if (path === "scoring") {
            if (method === "PUT") mockScoring = {...(payload as ManageScoringInput), UpdatedAt: new Date().toISOString()};
            return schema.parse(mockScoring);
        }
        if (path === "content") return schema.parse({...mockContent, Landing: readMockLanding(mockContent.Landing), LandingDraft: readMockLandingDraft()});
        if (path === "content/variables") return schema.parse([
            {name: "event.name", label: "Назва події", format: "text", audience: 0},
            {name: "event.startAt", label: "Початок", format: "date-time", audience: 0},
            {name: "event.finishAt", label: "Завершення за розкладом", format: "date-time", audience: 0},
            {name: "event.isStarted", label: "Розпочато", format: "boolean", audience: 0},
            {name: "event.approvedTeamCount", label: "Схвалені команди", format: "number", audience: 0},
            {name: "event.publishAt", label: "Час публікації", format: "date-time", audience: 2},
        ]);
        if (path === "pages") {
            if (method === "POST") {
                const draft = ManagePageDraftSchema.parse(payload);
                const page = ManagePageSchema.parse({ID: crypto.randomUUID(), ...draft, NavigationOrder: 0, Draft: draft, PublishedAt: null});
                mockPages = [...mockPages, page];
                return schema.parse(page);
            }
            return schema.parse(mockPages);
        }
        if (path.startsWith("pages/")) {
            const [rawKey, action] = path.slice(6).split("/");
            const key = decodeURIComponent(rawKey);
            const page = mockPages.find(item => item.ID === key) ?? mockPages.find(item => item.Slug === key) ?? mockPages.find(item => item.Draft?.Slug === key);
            if (!page) throw new ManageApiError(404);
            if (action === "publish" && method === "POST") {
                if (!page.Draft) throw new ManageApiError(404);
                return schema.parse(mockPublishPage(page));
            }
            if (action === "draft" && method === "DELETE") {
                if (!page.Draft || !page.PublishedAt) throw new ManageApiError(404);
                mockPages = mockPages.map(item => item.ID === page.ID ? {...item, Draft: null} : item);
                return schema.parse(undefined);
            }
            if (method === "DELETE") {
                mockPages = mockPages.filter(item => item.ID !== page.ID);
                return schema.parse(undefined);
            }
            if (method === "PUT") {
                const draft = ManagePageDraftSchema.parse(payload);
                if (mockPages.some(item => item.ID !== page.ID && (item.Slug === draft.Slug || item.Draft?.Slug === draft.Slug))) throw new ManageApiError(409);
                const updated = ManagePageSchema.parse(page.PublishedAt ? {...page, Draft: draft} : {...page, ...draft, Draft: draft});
                mockPages = mockPages.map(item => item.ID === page.ID ? updated : item);
                return schema.parse(updated);
            }
            return schema.parse(page);
        }
        if (path === "content/landing/publish" && method === "POST") {
            const draft = readMockLandingDraft();
            if (!draft) throw new ManageApiError(404);
            mockContent = {...mockContent, Landing: draft};
            writeMockLanding(draft);
            writeMockLandingDraft(null);
            return schema.parse(undefined);
        }
        if (path === "content/landing/draft" && method === "DELETE") {
            if (!readMockLandingDraft()) throw new ManageApiError(404);
            writeMockLandingDraft(null);
            return schema.parse(undefined);
        }
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
    if (!response.ok) throw await manageApiError(response);
    if (response.status === 204) return schema.parse(undefined);
    const envelope = z.object({Data: schema}).parse(await response.json());
    return envelope.Data;
}

export const getManageAccess = (eventID: string) => request(eventID, "access", accessSchema);
export const getManageName = (eventID: string) => request(eventID, "name", nameSchema);
export const putManageName = (eventID: string, name: string) => request(eventID, "name", nameSchema, "PUT", {Name: name});
export const getManageConfig = (eventID: string) => request(eventID, "config", ManageConfigSchema);
export const putManageConfig = (eventID: string, config: ManageConfigInput) => request(eventID, "config", ManageConfigSchema, "PUT", config);
export const putManageTheme = (eventID: string, theme: ManageThemeInput) => request(eventID, "theme", ManageConfigSchema, "PUT", theme);

const generalResultSchema = z.object({Name: z.string(), Config: ManageConfigSchema});
const appearanceResultSchema = z.object({Config: ManageConfigSchema, LogoURL: z.string(), FaviconURL: z.string()});
export const putManageGeneral = (eventID: string, input: ManageGeneralInput) => request(eventID, "general", generalResultSchema, "PUT", input);
export const putManageAppearance = (eventID: string, input: ManageAppearanceInput) => request(eventID, "appearance", appearanceResultSchema, "PUT", input);

export async function uploadManageBrandDraft(eventID: string, kind: "preview" | "logo" | "favicon", file: File): Promise<string> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const id = crypto.randomUUID();
        mockBrandDrafts.set(id, URL.createObjectURL(file));
        return id;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/brand-drafts/${kind}`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({FileID: z.string().uuid()})}).parse(await response.json());
    return envelope.Data.FileID;
}

export async function uploadManageBannerImage(eventID: string, file: File): Promise<string> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return URL.createObjectURL(file);
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/content-images`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({ImageURL: z.string()})}).parse(await response.json());
    return envelope.Data.ImageURL;
}

export async function uploadManageLogo(eventID: string, file: File): Promise<string> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return URL.createObjectURL(file);
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/logo`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({LogoURL: z.string()})}).parse(await response.json());
    return envelope.Data.LogoURL;
}

export async function removeManageLogo(eventID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/logo`, {
        method: "DELETE", credentials: "include", cache: "no-store",
    });
    if (!response.ok) throw await manageApiError(response);
}

export async function uploadManagePreviewPicture(eventID: string, file: File): Promise<string> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockConfig = {...mockConfig, PreviewPicture: URL.createObjectURL(file)};
        return mockConfig.PreviewPicture;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/preview-picture`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({PreviewPicture: z.string()})}).parse(await response.json());
    return envelope.Data.PreviewPicture;
}

export async function removeManagePreviewPicture(eventID: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockConfig = {...mockConfig, PreviewPicture: ""};
        return;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/preview-picture`, {
        method: "DELETE", credentials: "include", cache: "no-store",
    });
    if (!response.ok) throw await manageApiError(response);
}
export const getManageLifecycle = (eventID: string) => request(eventID, "lifecycle", ManageLifecycleSchema);
export const putManageLifecycle = (eventID: string, input: ManageLifecycleInput) => request(eventID, "lifecycle", ManageLifecycleSchema, "PUT", input);
export const getManageScoring = (eventID: string) => request(eventID, "scoring", ManageScoringSchema);
export const putManageScoring = (eventID: string, input: ManageScoringInput) => request(eventID, "scoring", ManageScoringSchema, "PUT", input);
export const getManageContent = (eventID: string) => request(eventID, "content", ManageContentSchema);
export const getManageContentVariables = (eventID: string) => request(eventID, "content/variables", ContentVariableCatalogSchema);
export const getManagePage = (eventID: string, slug: string) => request(eventID, `pages/${encodeURIComponent(slug)}`, ManagePageSchema);
export const getManagePages = (eventID: string) => request(eventID, "pages", z.array(ManagePageSchema));
// Create and save store a draft; only publish makes the page (with its settings
// and navbar place) public.
export const createManagePage = (eventID: string, page: ManagePageInput) => request(eventID, "pages", ManagePageSchema, "POST", page);
export const saveManagePageDraft = (eventID: string, pageID: string, page: ManagePageInput) => request(eventID, `pages/${encodeURIComponent(pageID)}`, ManagePageSchema, "PUT", page);
export const publishManagePage = (eventID: string, pageID: string) => request(eventID, `pages/${encodeURIComponent(pageID)}/publish`, ManagePageSchema, "POST");
export const discardManagePageDraft = (eventID: string, pageID: string) => request(eventID, `pages/${encodeURIComponent(pageID)}/draft`, z.undefined(), "DELETE");
export const deleteManagePage = (eventID: string, pageID: string) => request(eventID, `pages/${encodeURIComponent(pageID)}`, z.undefined(), "DELETE");
export const publishManageLanding = (eventID: string) => request(eventID, "content/landing/publish", z.undefined(), "POST");
export const discardManageLandingDraft = (eventID: string) => request(eventID, "content/landing/draft", z.undefined(), "DELETE");

// Saves the landing draft; the site keeps the published landing until publish.
export async function putManageLanding(eventID: string, document: ContentDocument): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        writeMockLandingDraft(ContentDocumentSchema.parse(document));
        return;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/content/landing`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Document: document}),
    });
    if (!response.ok) throw await manageApiError(response);
}
