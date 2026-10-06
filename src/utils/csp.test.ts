import {describe, expect, it} from "vitest";
import {buildCsp, generateNonce} from "@/utils/csp";

const prod = {NEXT_PUBLIC_DOMAIN: "example.test", NODE_ENV: "production"};
const directive = (csp: string, name: string) => csp.split("; ").find(d => d.startsWith(`${name} `)) ?? "";

describe("buildCsp", () => {
    it("locks scripts to self and the nonce, with no unsafe-inline or strict-dynamic", () => {
        const script = directive(buildCsp("N0NCE", prod), "script-src");
        expect(script).toBe("script-src 'self' 'nonce-N0NCE'");
    });

    it("sets the hard lockdown directives", () => {
        const csp = buildCsp("n", prod);
        for (const d of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "upgrade-insecure-requests"]) expect(csp).toContain(d);
    });

    it("takes the API origin from env and adds no analytics hosts without a GA id", () => {
        const connect = directive(buildCsp("n", prod), "connect-src");
        expect(connect).toBe("connect-src 'self' https://api.example.test");
        expect(buildCsp("n", prod)).not.toContain("google");
    });

    it("allows Google Analytics only when configured", () => {
        const csp = buildCsp("n", {...prod, NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: "G-TEST"});
        expect(directive(csp, "script-src")).toContain("https://www.googletagmanager.com");
        expect(directive(csp, "connect-src")).toContain("https://*.google-analytics.com");
    });

    it("keeps styles nonce-based in production, attributes only inline", () => {
        const csp = buildCsp("n", prod);
        expect(directive(csp, "style-src")).toBe("style-src 'self' 'nonce-n'");
        expect(directive(csp, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
    });

    it("relaxes only dev: eval, HMR websocket, inline styles, no upgrade", () => {
        const csp = buildCsp("n", {...prod, NODE_ENV: "development"});
        expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
        expect(directive(csp, "connect-src")).toContain("ws:");
        expect(directive(csp, "style-src")).toContain("'unsafe-inline'");
        expect(csp).not.toContain("upgrade-insecure-requests");
        expect(buildCsp("n", prod)).not.toContain("unsafe-eval");
    });

    it("keeps remote images, blob and data for organizer content and QR codes", () => {
        expect(directive(buildCsp("n", prod), "img-src")).toBe("img-src 'self' data: blob: https:");
    });
});

describe("generateNonce", () => {
    it("is unique and base64", () => {
        const a = generateNonce();
        expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(a).not.toBe(generateNonce());
    });
});
