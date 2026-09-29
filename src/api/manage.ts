import {z} from "zod";
import {readApiErrorCode} from "@/api/apiErrors";
import {EventThemeSchema} from "@/types/eventTheme";
import {ContentDocumentSchema, ContentValueSchema, type ContentDocument} from "@/types/eventContent";
import {ContentVariableCatalogSchema} from "@/components/event/content/variableCatalog";
import {requireApiOrigin} from "@/utils/origins";

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
    ForceEventScoring: z.boolean(),
    // Static scoring's one value; null = each task's own points.
    StaticPoints: z.number().int().nullish().transform(value => value ?? null),
    UpdatedAt: z.string(),
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

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
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
    const api = requireApiOrigin();
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/brand-drafts/${kind}`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({FileID: z.string().uuid()})}).parse(await response.json());
    return envelope.Data.FileID;
}

export async function uploadManageBannerImage(eventID: string, file: File): Promise<string> {
    const api = requireApiOrigin();
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/content-images`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({ImageURL: z.string()})}).parse(await response.json());
    return envelope.Data.ImageURL;
}

export async function uploadManageLogo(eventID: string, file: File): Promise<string> {
    const api = requireApiOrigin();
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/logo`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({LogoURL: z.string()})}).parse(await response.json());
    return envelope.Data.LogoURL;
}

export async function removeManageLogo(eventID: string): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/logo`, {
        method: "DELETE", credentials: "include", cache: "no-store",
    });
    if (!response.ok) throw await manageApiError(response);
}

export async function uploadManagePreviewPicture(eventID: string, file: File): Promise<string> {
    const api = requireApiOrigin();
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/preview-picture`, {
        method: "POST", credentials: "include", cache: "no-store", body,
    });
    if (!response.ok) throw await manageApiError(response);
    const envelope = z.object({Data: z.object({PreviewPicture: z.string()})}).parse(await response.json());
    return envelope.Data.PreviewPicture;
}

export async function removeManagePreviewPicture(eventID: string): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/preview-picture`, {
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
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/content/landing`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Document: document}),
    });
    if (!response.ok) throw await manageApiError(response);
}
