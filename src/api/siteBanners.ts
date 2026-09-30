import {z} from "zod";
import {apiOrigin} from "@/utils/origins";

// The banners the current viewer sees on the event site. Public; the session
// is optional (it only widens the audience). Critical ones come first.
const visibleBannerSchema = z.object({
    ID: z.string(), Text: z.string(), LinkURL: z.string().nullish().transform(value => value ?? ""),
    LinkLabel: z.string().nullish().transform(value => value ?? ""), Level: z.enum(["info", "warning", "critical"]).catch("info"),
    Dismissible: z.boolean(), Version: z.number(),
});
export type VisibleBanner = z.infer<typeof visibleBannerSchema>;

export async function getSiteBanners(eventID: string): Promise<VisibleBanner[]> {
    if (!apiOrigin) return [];
    const response = await fetch(`${apiOrigin}/api/banners?event=${encodeURIComponent(eventID)}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new Error(`Banners request failed: ${response.status}`);
    return z.object({Data: z.array(visibleBannerSchema).nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}
