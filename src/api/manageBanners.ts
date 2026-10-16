import {z} from "zod";
import {ManageApiError, manageApiError} from "@/api/manage";
import {ApiErrorCode} from "@/api/apiErrors";
import {requireApiOrigin} from "@/utils/origins";

// Site banners of an event (docs/BROADCASTS.md, «Банери»).

const text = z.string().nullish().transform(value => value ?? "");

export const bannerLevels = ["info", "warning", "critical"] as const;
export type BannerLevel = typeof bannerLevels[number];
export const bannerAudiences = ["everyone", "signed_in", "participants"] as const;
export type BannerAudience = typeof bannerAudiences[number];
export const BANNER_TEXT_MAX = 280;
export const BANNER_LABEL_MAX = 60;

const bannerSchema = z.object({
    ID: z.string().uuid(), ScopeEventID: z.string().uuid().nullable(), Text: z.string(), LinkURL: text, LinkLabel: text,
    Level: z.enum(bannerLevels).catch("info"), ActiveFrom: z.string().nullable(), ActiveTo: z.string().nullable(),
    Dismissible: z.boolean(), Audience: z.enum(bannerAudiences).catch("everyone"), IsActive: z.boolean(),
    CreatedAt: z.string(), UpdatedAt: z.string(),
});
export type ManageBanner = z.infer<typeof bannerSchema>;
export type ManageBannerInput = Pick<ManageBanner, "Text" | "LinkURL" | "LinkLabel" | "Level" | "ActiveFrom" | "ActiveTo" | "Dismissible" | "Audience" | "IsActive">;

export function bannerInput(banner: ManageBanner): ManageBannerInput {
    return {
        Text: banner.Text, LinkURL: banner.LinkURL, LinkLabel: banner.LinkLabel, Level: banner.Level, ActiveFrom: banner.ActiveFrom,
        ActiveTo: banner.ActiveTo, Dismissible: banner.Dismissible, Audience: banner.Audience, IsActive: banner.IsActive,
    };
}

const bannerServerFields = {
    "Banner text is required": "Text",
    "Banner link label is too long": "LinkLabel",
    "Banner link must be an https address or a site path": "LinkURL",
    "Banner end must be after its start": "ActiveTo",
} as const;

// Read only stable server validation identifiers; raw response text is never UI copy.
export class ManageBannerFieldError extends ManageApiError {
    constructor(error: ManageApiError, readonly field: typeof bannerServerFields[keyof typeof bannerServerFields]) {
        super(error.status, error.code, error.retryAfter, error.context, error.requestId);
    }
}

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/banners${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) {
        const body: unknown = await response.clone().json().catch(() => null);
        const parsed = z.object({Status: z.object({Message: z.string().optional()})}).safeParse(body);
        const error = await manageApiError(response);
        const field = parsed.success ? bannerServerFields[parsed.data.Status.Message as keyof typeof bannerServerFields] : undefined;
        if (error.code === ApiErrorCode.BannerInvalid && field) throw new ManageBannerFieldError(error, field);
        throw error;
    }
    if (response.status === 204) return schema.parse(undefined);
    const raw: unknown = await response.json().catch(() => null);
    return z.object({Data: schema}).parse(raw ?? {Data: undefined}).Data;
}

export const getManageBanners = (eventID: string) => request(eventID, "", z.array(bannerSchema).nullish().transform(value => value ?? []));
export const createManageBanner = (eventID: string, input: ManageBannerInput) => request(eventID, "", bannerSchema, "POST", input);
export const updateManageBanner = (eventID: string, bannerID: string, input: ManageBannerInput) => request(eventID, `/${encodeURIComponent(bannerID)}`, bannerSchema, "PUT", input);
export const deleteManageBanner = (eventID: string, bannerID: string) => request(eventID, `/${encodeURIComponent(bannerID)}`, z.unknown().optional(), "DELETE");
