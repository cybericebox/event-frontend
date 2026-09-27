import {z} from "zod";

const pageSchema = z.object({Slug: z.string(), Title: z.string(), NavigationOrder: z.number().int()});
const pagesSchema = z.array(pageSchema);
export type NavigationPage = z.infer<typeof pageSchema>;

export async function getNavigationPages(eventID: string): Promise<NavigationPage[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return [{Slug: "faq", Title: "Питання та відповіді", NavigationOrder: 0}];
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/content/pages`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Event navigation request failed: ${response.status}`);
    const data: unknown = await response.json();
    return z.object({Data: pagesSchema}).parse(data).Data;
}
