import {z} from "zod";
import {ManageApiError} from "./manage";
import {requireApiOrigin} from "@/utils/origins";

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
});
export type LiveLayout = z.infer<typeof liveLayoutSchema>;
export type LiveWidget = LiveLayout["widgets"][number];
const editorSchema = z.object({Published: liveLayoutSchema, Draft: liveLayoutSchema.nullable()});
export type LiveEditor = z.infer<typeof editorSchema>;

export const defaultLiveLayout: LiveLayout = {
    version: 1, theme: "dark", aspect: "16:9", screen: {width: 1920, height: 1080, anchor: "full", textScale: 1},
    grid: {cols: 12, rows: 8}, widgets: [
        {id: "title", type: "title", x: 1, y: 1, w: 12, h: 1, props: {}},
        {id: "chart", type: "chart", x: 1, y: 2, w: 8, h: 6, props: {}},
        {id: "table", type: "table", x: 9, y: 2, w: 4, h: 6, props: {}},
        {id: "organizers", type: "logos", x: 1, y: 8, w: 3, h: 1, props: {mode: "fixed", title: "Організатори"}},
        {id: "partners", type: "logos", x: 4, y: 8, w: 9, h: 1, props: {mode: "carousel", title: "Партнери"}},
    ],
};

// 400 code 21122 on publish: the stored draft is invalid (legacy grid below 3×3).
export class LiveDraftInvalidError extends ManageApiError {
    constructor() {
        super(400);
    }
}

// Mock screens: ?mockTheme=light and ?mockScreen=1040x624 (fixed top-left area).
function mockPublished(): LiveLayout {
    if (typeof window === "undefined") return defaultLiveLayout;
    const params = new URLSearchParams(window.location.search);
    const [width, height] = (params.get("mockScreen") ?? "").split("x").map(Number);
    const theme = params.get("mockTheme") === "light" ? "light" : "dark";
    return width > 0 && height > 0
        ? {...defaultLiveLayout, theme, aspect: "custom", screen: {width, height, anchor: "top-left", textScale: 1}}
        : {...defaultLiveLayout, theme};
}

let mockEditor: LiveEditor = {Published: mockPublished(), Draft: null};

async function liveRequest<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        if (method === "PUT") {mockEditor = {...mockEditor, Draft: liveLayoutSchema.parse((payload as {Layout: LiveLayout}).Layout)}; return schema.parse(undefined);}
        if (method === "POST") {
            if (!mockEditor.Draft) throw new ManageApiError(404);
            mockEditor = {Published: {...mockEditor.Draft, version: mockEditor.Published.version + 1}, Draft: null};
            return schema.parse(mockEditor.Published);
        }
        return schema.parse(mockEditor);
    }
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

// Open live screens poll this light version and reload the layout on a change.
export async function getLiveLayoutVersion(eventID: string): Promise<number> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockEditor.Published.version;
    return liveRequest(eventID, "/version", z.object({Version: z.number().int()})).then(value => value.Version);
}
