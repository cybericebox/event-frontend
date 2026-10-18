import {cache} from "react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {getCommonManifest, readContext} from "./commonPage";

// The event of a hidden site, read for its staff: a valid preview grant (verified in readContext) opens the
// render routes, so a personal route (anonymous public-info answers 404) still knows the event branding.
// Without a grant, or on any failure, the branding stays unknown and the browser loads it.
export const getGrantedEvent = cache(async (): Promise<PublicEventInfo | null> => {
    try {
        const context = await readContext();
        if (!context?.claims?.preview) return null;
        const manifest = await getCommonManifest();
        return manifest?.Audience === "staff" ? manifest.Event : null;
    } catch {
        return null;
    }
});
