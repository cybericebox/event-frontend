import {NextResponse, type NextRequest} from "next/server";
import {buildCsp, generateNonce} from "@/utils/csp";

// Per-request nonce CSP. The nonce goes to the render through the request headers
// (Next reads it from the CSP header and stamps its own scripts) and to the browser
// through the response header. The layout reads x-nonce for its inline scripts.
export function proxy(request: NextRequest) {
    const nonce = generateNonce();
    const csp = buildCsp(nonce, {
        NEXT_PUBLIC_API_HOST: process.env.NEXT_PUBLIC_API_HOST,
        NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
        NODE_ENV: process.env.NODE_ENV,
    });
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const response = NextResponse.next({request: {headers}});
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

export const config = {
    matcher: [{
        source: "/((?!api|_next/static|_next/image|favicon.ico|platform-favicon.ico|assets).*)",
        missing: [
            {type: "header", key: "next-router-prefetch"},
            {type: "header", key: "purpose", value: "prefetch"},
        ],
    }],
};
