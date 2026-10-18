import {NextResponse, type NextRequest} from "next/server";
import {buildCsp, generateNonce} from "@/utils/csp";
import {eventHostMissing} from "@/utils/server/eventHostMissing";
import {READ_COOKIE, hasStaffGrant} from "@/utils/server/staffGrant";

// Per-request nonce CSP. The nonce goes to the render through the request headers
// (Next reads it from the CSP header and stamps its own scripts) and to the browser
// through the response header. The layout reads x-nonce for its inline scripts.
// A rewrite counts as internal only when its origin is the one this server listens on (the same rule Next uses for its own
// request URL: HOSTNAME and PORT, https when the edge says so). request.nextUrl carries the public host, which Next would
// then try to reach as an external site.
function ownURL(request: NextRequest): URL {
    const protocol = request.headers.get("x-forwarded-proto")?.includes("https") ? "https" : "http";
    const hostname = process.env.HOSTNAME || "localhost";
    const url = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `${protocol}://${hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname}:${process.env.PORT || 3000}`);
    return url;
}

export async function proxy(request: NextRequest) {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, {
        NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN,
        NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
        NODE_ENV: process.env.NODE_ENV,
    });
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("x-event-pathname", request.nextUrl.pathname);
    headers.set("Content-Security-Policy", csp);
    // An unknown or hidden event answers 404 with the page it always had: the status is the only change.
    // The check is anonymous, so a hidden event stays 200 for its staff: a valid preview grant for this host.
    const host = request.headers.get("host");
    const missing = (await eventHostMissing(host)) && !(await hasStaffGrant(host, request.cookies.get(READ_COOKIE)?.value));
    const response = missing ? NextResponse.rewrite(ownURL(request), {request: {headers}, status: 404}) : NextResponse.next({request: {headers}});
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

export const config = {
    matcher: [{
        source: "/((?!api|_next/static|_next/image|favicon.ico|platform-favicon.ico|assets).*)",
    }],
};
