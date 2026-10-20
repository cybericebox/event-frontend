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
    if (!next.startsWith("/") || next.startsWith("//") || /[\\\r\n]/.test(next)) throw new Error("Invalid proxy destination");
    if (next !== "/") auth.searchParams.set("next", next);
    return auth.href;
}
