import {z} from "zod";
import {ManageApiError} from "./manage";
import {requireApiOrigin} from "@/utils/origins";
import {resultsSnapshotSchema} from "./manageResults";
import {PublicEventInfoSchema} from "@/types/publicEventInfo";
import {t} from "@/i18n/t";

export const liveRefreshDefault = 5;
export const liveRefreshOptions = [2, 3, 5, 10, 15, 20, 30];

const widgetSchema = z.object({
    id: z.string(), type: z.enum(["title", "timer", "chart", "table", "ad_table", "logos", "solves", "announcement", "qr"]),
    x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int(),
    props: z.record(z.string(), z.unknown()),
});
export const liveLayoutSchema = z.object({
    version: z.number().int(), theme: z.enum(["dark", "light"]),
    aspect: z.enum(["16:9", "16:10", "4:3", "5:3", "custom"]),
    screen: z.object({width: z.number().int(), height: z.number().int(), anchor: z.enum(["full", "top-left"]), textScale: z.number()}),
    grid: z.object({cols: z.number().int(), rows: z.number().int()}),
    widgets: z.array(widgetSchema),
    // Results refresh on the open screen, 2–30 s; layouts stored before the
    // setting existed get the default.
    refreshSeconds: z.number().int().optional().transform(value => value || liveRefreshDefault),
});
export type LiveLayout = z.output<typeof liveLayoutSchema>;
export type LiveWidget = LiveLayout["widgets"][number];
const editorSchema = z.object({Published: liveLayoutSchema, Draft: liveLayoutSchema.nullable()});
export type LiveEditor = z.infer<typeof editorSchema>;

export const defaultLiveLayout: LiveLayout = {
    version: 1, theme: "dark", aspect: "16:9", refreshSeconds: liveRefreshDefault, screen: {width: 1920, height: 1080, anchor: "full", textScale: 1},
    grid: {cols: 12, rows: 8}, widgets: [
        {id: "title", type: "title", x: 1, y: 1, w: 10, h: 1, props: {}},
        {id: "chart", type: "chart", x: 1, y: 2, w: 8, h: 6, props: {}},
        {id: "table", type: "table", x: 9, y: 2, w: 4, h: 6, props: {}},
        {id: "organizers", type: "logos", x: 1, y: 8, w: 3, h: 1, props: {mode: "fixed", title: t("manage.live.defaultOrganizers")}},
        {id: "partners", type: "logos", x: 4, y: 8, w: 9, h: 1, props: {mode: "carousel", title: t("manage.live.defaultPartners")}},
        {id: "timer", type: "timer", x: 11, y: 1, w: 2, h: 1, props: {}},
    ],
};

// 400 code 21122 on publish: the stored draft is invalid (legacy grid below 3×3).
export class LiveDraftInvalidError extends ManageApiError {
    constructor() {
        super(400);
    }
}

async function liveRequest<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/content/live${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (response.status === 400) {
        const body = z.object({Status: z.object({Code: z.number()})}).safeParse(await response.json().catch(() => null));
        throw body.success && body.data.Status.Code === 21122 ? new LiveDraftInvalidError() : new ManageApiError(400);
    }
    if (!response.ok) throw new ManageApiError(response.status);
    if (response.status === 204) return schema.parse(undefined);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export const getManageLive = (eventID: string) => liveRequest(eventID, "", editorSchema);
export const saveManageLiveDraft = (eventID: string, layout: LiveLayout) => liveRequest(eventID, "", z.undefined(), "PUT", {Layout: layout});
export const publishManageLive = (eventID: string) => liveRequest(eventID, "/publish", liveLayoutSchema, "POST");

// The live screen is a manager view (L1): it reads the published layout
// through the management API, so unpublished events work too.
export const getPublishedLiveLayout = async (eventID: string) => (await getManageLive(eventID)).Published;

// A logo for the Live logos widgets: SVG (sanitized by the server), PNG or
// WebP up to 1 MB; the server sniffs the content.
export const liveLogoAccept = ".svg,.png,.webp,image/svg+xml,image/png,image/webp";
export const liveLogoMaxBytes = 1 << 20;
export async function uploadLiveLogo(eventID: string, file: File): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/content/live/logos`, {method: "POST", credentials: "include", cache: "no-store", body});
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: z.object({ImageURL: z.string()})}).parse(await response.json()).Data.ImageURL;
}

// Open live screens poll this light version and reload the layout on a change.
export async function getLiveLayoutVersion(eventID: string): Promise<number> {
    return liveRequest(eventID, "/version", z.object({Version: z.number().int()})).then(value => value.Version);
}

// The screen link («Посилання для перегляду Live»): one per event; a token
// opens this event's live screen on a projector PC that is not signed in.
// The token comes back only when the link is created or regenerated.
export const liveScreenExpiries = ["none", "day", "week", "event_end"] as const;
export type LiveScreenExpiry = typeof liveScreenExpiries[number];
const screenLinkSchema = z.object({ID: z.string(), CreatedAt: z.string(), ExpiresAt: z.string().nullable(), Token: z.string().optional()});
export type LiveScreenLink = z.infer<typeof screenLinkSchema>;

export const getLiveScreenLink = (eventID: string) => liveRequest(eventID, "/screen-link", z.object({Link: screenLinkSchema.nullable()})).then(value => value.Link);
export const issueLiveScreenLink = (eventID: string, expiry: LiveScreenExpiry) => liveRequest(eventID, "/screen-link", screenLinkSchema, "POST", {Expiry: expiry});
export const regenerateLiveScreenLink = (eventID: string) => liveRequest(eventID, "/screen-link/regenerate", screenLinkSchema, "POST");
export const revokeLiveScreenLink = (eventID: string) => liveRequest(eventID, "/screen-link", z.undefined(), "DELETE");

// The URL a screen opens: the token rides in the fragment, so it never
// reaches the event site's server logs.
export function liveScreenURL(origin: string, token: string): string {
    return `${origin}/live#screen=${encodeURIComponent(token)}`;
}

export function liveScreenTokenFromHash(hash: string): string | null {
    return new URLSearchParams(hash.replace(/^#/, "")).get("screen") || null;
}

export class LiveScreenLinkError extends Error {
    constructor(readonly status: number) {
        super(`Live screen link request failed: ${status}`);
    }
}

function screenURL(path: string, token: string, params: Record<string, string> = {}): string {
    const query = new URLSearchParams({token, ...params});
    return `${requireApiOrigin()}/api/events/self/live-screen${path}?${query}`;
}

async function screenRequest<T>(path: string, token: string, schema: z.ZodType<T>): Promise<T> {
    // The event comes from the Origin of this site; no session is used.
    const response = await fetch(screenURL(path, token), {credentials: "omit", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw new LiveScreenLinkError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export const getLiveScreenByLink = (token: string) => screenRequest("", token, z.object({Event: PublicEventInfoSchema, Layout: liveLayoutSchema}));
export const getLiveScreenResultsByLink = (token: string) => screenRequest("/results", token, resultsSnapshotSchema);
export function liveScreenResultsStreamURL(token: string, revision: number, refreshSeconds: number): string {
    return screenURL("/results/live", token, {lastEventId: String(revision), pollInterval: String(refreshSeconds)});
}
