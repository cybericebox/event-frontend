import {z} from "zod";
import {ManageApiError} from "./manage";

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

let mockEditor: LiveEditor = {Published: defaultLiveLayout, Draft: null};

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
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/content/live${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw new ManageApiError(response.status);
    if (response.status === 204) return schema.parse(undefined);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export const getManageLive = (eventID: string) => liveRequest(eventID, "", editorSchema);
export const saveManageLiveDraft = (eventID: string, layout: LiveLayout) => liveRequest(eventID, "", z.undefined(), "PUT", {Layout: layout});
export const publishManageLive = (eventID: string) => liveRequest(eventID, "/publish", liveLayoutSchema, "POST");

export async function getPublishedLiveLayout(eventID: string): Promise<LiveLayout> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockEditor.Published;
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/content`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return liveLayoutSchema.parse(z.object({Data: z.object({Live: z.unknown()})}).parse(await response.json()).Data.Live);
}
