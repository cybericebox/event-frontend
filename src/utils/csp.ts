// Content-Security-Policy builder. Pure: the proxy passes the nonce and the env in.
// Every origin derives from NEXT_PUBLIC_DOMAIN; the only literals are Google Analytics'
// own endpoints, added only when NEXT_PUBLIC_GOOGLE_ANALYTICS_ID is set.

import {deriveHosts} from "@/utils/hosts";

export type CspEnv = {
    NEXT_PUBLIC_DOMAIN?: string;
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?: string;
    NODE_ENV?: string;
};

const GA_SCRIPT = ["https://www.googletagmanager.com"];
const GA_CONNECT = [
    "https://www.googletagmanager.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
];

export function generateNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}

function hostOrigin(host: string | undefined): string | null {
    const value = host?.trim();
    return value ? `https://${value}` : null;
}

export function buildCsp(nonce: string, env: CspEnv): string {
    const dev = env.NODE_ENV === "development";
    const domain = env.NEXT_PUBLIC_DOMAIN?.trim();
    const api = hostOrigin(domain ? deriveHosts(domain).api : undefined);
    const ga = Boolean(env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim());

    const scriptSrc = ["'self'", `'nonce-${nonce}'`, ...(ga ? GA_SCRIPT : []), ...(dev ? ["'unsafe-eval'"] : [])];
    // Next's dev server injects <style> tags without a nonce; production uses nonce + files only.
    const styleSrc = dev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`];
    const connectSrc = ["'self'", ...(api ? [api] : []), ...(ga ? GA_CONNECT : []), ...(dev ? ["ws:", "wss:"] : [])];

    const directives: Record<string, string[]> = {
        "default-src": ["'self'"],
        "script-src": scriptSrc,
        "style-src": styleSrc,
        // React renders style="" attributes (theme variables, text alignment): attributes only, never <style>.
        "style-src-attr": ["'unsafe-inline'"],
        // Organizer images (logos, banners, markdown) come from any https host; blob/data for QR codes and previews.
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:"],
        "connect-src": connectSrc,
        "media-src": ["'self'", "blob:", "https:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "frame-src": ["'none'"],
        "worker-src": ["'self'", "blob:"],
        "manifest-src": ["'self'"],
    };
    const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
    if (!dev) parts.push("upgrade-insecure-requests");
    return parts.join("; ");
}
