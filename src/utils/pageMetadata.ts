import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";

// The tab title of an event page: «{Сторінка} · {Захід}». Pages that only make sense for a signed-in
// person (join, invite, forms) are kept out of search results.
export async function eventPageMetadata(title: string, options: {noindex?: boolean} = {}): Promise<Metadata> {
    let name: string | undefined;
    try {
        name = (await getPublicEventInfo())?.Name;
    } catch {
        name = undefined;
    }
    return {
        title: name ? `${title} · ${name}` : title,
        ...(options.noindex ? {robots: {index: false, follow: false}} : {}),
    };
}
