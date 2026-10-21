import {z} from "zod";
import {apiOrigin} from "@/utils/origins";

// The banners the current viewer sees on the event site (backend: GET /api/notifications/banners).
// Public; the session is optional (it widens the audience). The list is refetched only when
// the pulse reports a new Banners version. Kind: site and system banners are dismissed locally by
// `${ID}:${Version}`, personal ones on the server.
const visibleBannerSchema = z.object({
    ID: z.string(), Kind: z.enum(["site", "system", "personal"]).catch("site"), Title: z.string().nullish().transform(value => value ?? ""),
    Text: z.string(), LinkURL: z.string().nullish().transform(value => value ?? ""),
    LinkLabel: z.string().nullish().transform(value => value ?? ""), Level: z.enum(["info", "warning", "critical"]).catch("info"),
    Dismissible: z.boolean(), Version: z.number(),
    // A banner without text (a personal one) shows its title instead.
}).transform(banner => ({...banner, Text: banner.Text.trim() ? banner.Text : banner.Title}));
export type VisibleBanner = z.infer<typeof visibleBannerSchema>;

export async function getSiteBanners(eventID: string): Promise<VisibleBanner[]> {
    if (!apiOrigin) return [];
    const query = new URLSearchParams({site: "event", event: eventID});
    const response = await fetch(`${apiOrigin}/api/notifications/banners?${query}`, {
        credentials: "include", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new Error(`Banners request failed: ${response.status}`);
    return z.object({Data: z.array(visibleBannerSchema).nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}

export async function dismissPersonalBanner(id: string): Promise<void> {
    if (!apiOrigin) return;
    const response = await fetch(`${apiOrigin}/api/notifications/banners/${encodeURIComponent(id)}/dismiss`, {
        method: "PATCH", credentials: "include", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new Error(`Banner dismissal failed: ${response.status}`);
}
