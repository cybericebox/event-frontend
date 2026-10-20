import {copyBlockUrl} from "./CopyBlock";

export function matchesProxyDestination(destination: string, resolvedVariable: string): boolean {
    const target = copyBlockUrl(destination); const variable = copyBlockUrl(resolvedVariable);
    return !!target && !!variable && new URL(target).origin === new URL(variable).origin;
}

// The proxy authenticates once, then redirects to this validated local path.
// Never turn a composed docs URL into a different device's authenticated tab.
export function proxyDestinationURL(authURL: string, destination?: string): string {
    if (!destination) return authURL;
    if (!matchesProxyDestination(destination, authURL)) throw new Error("Proxy destination origin changed");
    const target = new URL(destination); const auth = new URL(authURL);
    const next = `${target.pathname}${target.search}${target.hash}`;
    if (next === "/") return auth.href;
    let decoded = next;
    for (let pass = 0; pass < 4; pass++) {
        const unsafeCharacter = [...decoded].some(character => character === "\\" || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
        if (!decoded.startsWith("/") || decoded.startsWith("//") || unsafeCharacter) throw new Error("Invalid proxy destination");
        const value = new URL(decoded, auth.origin);
        if (value.origin !== auth.origin || value.pathname.includes("//") || value.pathname.replace(/\/+$/, "") === "/_auth") throw new Error("Invalid proxy destination");
        const unescaped = decodeURIComponent(decoded);
        if (unescaped === decoded) {auth.searchParams.set("next", next); return auth.href;}
        decoded = unescaped;
    }
    throw new Error("Invalid proxy destination");
}
