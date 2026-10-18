// The last known logo and favicon of this event host, kept in localStorage so a reload can paint the event
// brand at once while the fresh branding loads (a hidden event is anonymous in the server render, so the
// server cannot know it). Logo URLs carry the file id, so a new upload is a new URL and the cache reconciles
// itself. The page works without storage: every access is guarded.

const LOGO_PREFIX = "cib:event-logo:";
const FAVICON_PREFIX = "cib:event-favicon:";

function host(): string | null {
    return typeof window === "undefined" ? null : window.location.host;
}

function read(prefix: string): string | null {
    try {
        const h = host();
        return h ? window.localStorage.getItem(prefix + h) : null;
    } catch {
        return null;
    }
}

function write(prefix: string, value: string): void {
    try {
        const h = host();
        if (h) window.localStorage.setItem(prefix + h, value);
    } catch {
        // storage blocked or full: the cache is optional
    }
}

// null = nothing remembered; "" = the event is known to have no logo; otherwise the resolved logo URL.
export function readCachedLogo(): string | null {
    return read(LOGO_PREFIX);
}

export function writeCachedBrand(brand: {logo: string; favicon?: string}): void {
    write(LOGO_PREFIX, brand.logo);
    if (brand.favicon !== undefined) write(FAVICON_PREFIX, brand.favicon);
}

// The remembered branding of a private event must not outlive the access to it: sign-out and a denied access clear it.
export function clearCachedBrand(): void {
    try {
        const h = host();
        if (!h) return;
        window.localStorage.removeItem(LOGO_PREFIX + h);
        window.localStorage.removeItem(FAVICON_PREFIX + h);
    } catch {
        // storage blocked: nothing was remembered
    }
}

export function subscribeCachedBrand(onChange: () => void): () => void {
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
}

// Runs inline in <head>, only when the server could not tell the event's branding: rewrites the platform
// favicon the metadata renders to the remembered event favicon until the page has loaded.
export const FAVICON_BOOT_SCRIPT = `(function(){try{var u=localStorage.getItem(${JSON.stringify(FAVICON_PREFIX)}+location.host);if(!u)return;var f=function(){document.head.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(function(l){if(l.getAttribute("href")!==u){l.setAttribute("href",u);l.setAttribute("type","image/png")}})};f();var o=new MutationObserver(f);o.observe(document.head,{childList:true,subtree:true});window.addEventListener("load",function(){o.disconnect()})}catch(e){}})()`;
