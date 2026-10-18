import {apiOrigin} from "@/utils/origins";

// Pure and shared by the server render (layout, metadata) and the client: it must not live in a "use client"
// module, or a server call into it fails at runtime.
export function resolveEventLogoURL(logoURL: string): string | null {
    if (!logoURL) return null;
    if (/^https:\/\//.test(logoURL)) return logoURL;
    if (!logoURL.startsWith("/api/events/")) return null;
    return apiOrigin ? `${apiOrigin}${logoURL}` : null;
}
