import {NextResponse, type NextRequest} from "next/server";
import {buildCsp, generateNonce} from "@/utils/csp";
import {eventHostMissing} from "@/utils/server/eventHostMissing";

// Per-request nonce CSP. The nonce goes to the render through the request headers
// (Next reads it from the CSP header and stamps its own scripts) and to the browser
// through the response header. The layout reads x-nonce for its inline scripts.
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
    const missing = await eventHostMissing(request.headers.get("host"));
    const response = missing ? NextResponse.rewrite(request.nextUrl, {request: {headers}, status: 404}) : NextResponse.next({request: {headers}});
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

export const config = {
    matcher: [{
        source: "/((?!api|_next/static|_next/image|favicon.ico|platform-favicon.ico|assets).*)",
    }],
};
