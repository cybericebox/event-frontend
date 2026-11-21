// One place that decides which addresses a page may link to or load an image from. Pure and free of
// "use client", so the server render and the client share it. Organisers and the API supply these values,
// so every link and image source of event content passes here before it reaches an href or src.

export type LinkScheme = "https:" | "http:" | "mailto:";
export type LinkOptions = {schemes: readonly LinkScheme[]; anchors?: boolean};

// Whitespace, control characters and backslashes: browsers drop tabs and line breaks inside an address and
// read "\" as "/", so "/\evil.example" or "/<tab>/evil.example" would leave the site as "//evil.example".
const forbidden = (value: string): boolean => [...value].some(char => {
    const code = char.charCodeAt(0);
    return code <= 0x20 || (code >= 0x7f && code <= 0x9f) || char === "\\";
});

/** The address to put in an href, or null when it is not a site path, an allowed absolute address or an anchor. */
export function safeLinkHref(value: string | null | undefined, options: LinkOptions): string | null {
    if (typeof value !== "string") return null;
    const href = value.trim();
    if (!href || forbidden(href)) return null;
    if (href.startsWith("/")) return href.startsWith("//") ? null : href;
    if (href.startsWith("#")) return options.anchors && href.length > 1 ? href : null;
    try {
        const url = new URL(href);
        if (!options.schemes.includes(url.protocol as LinkScheme)) return null;
        if (url.protocol !== "mailto:" && (!url.hostname || url.username || url.password)) return null;
        return href;
    } catch {
        return null;
    }
}

/** The source to put in an img, or "" when it is not a local preview, a site path or a web address. */
export function safeMediaSrc(value: string | null | undefined): string {
    if (!value) return "";
    if (/^blob:/i.test(value) && !forbidden(value)) return value;
    return safeLinkHref(value, {schemes: ["https:", "http:"]}) ?? "";
}
