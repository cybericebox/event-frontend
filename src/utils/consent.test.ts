// Cookie consent (Google Consent Mode v2): denied by default; accept all / save choice
// map to analytics_storage only; the choice is one cookie on the parent domain.
// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as consent from "./consent";

function clearCookies() {
    for (const name of document.cookie.split("; ").map((c) => c.split("=")[0]).filter(Boolean)) document.cookie = `${name}=; path=/; max-age=0`;
}

function spyGtag() {
    const gtag = vi.fn();
    (window as {gtag?: unknown}).gtag = gtag;
    return gtag;
}

// jsdom (localhost) rejects a parent-domain cookie, so these tests use a host-only one.
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", ""));

afterEach(() => {
    clearCookies();
    vi.unstubAllEnvs();
    delete (window as {gtag?: unknown}).gtag;
});

describe("consent", () => {
    it("defaults every Consent Mode signal to denied, before config", () => {
        expect(consent.CONSENT_DEFAULTS).toEqual({
            analytics_storage: "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
        });
        const boot = consent.gtagBootScript("G-TEST");
        expect(boot.indexOf('"consent","default"')).toBeLessThan(boot.indexOf('"config"'));
    });

    it("boot script grants analytics only for a stored analytics:granted", () => {
        const run = (cookie: string) => {
            const w = {dataLayer: [] as ArrayLike<unknown>[]};
            new Function("window", "document", "dataLayer", consent.gtagBootScript("G-TEST"))(w, {cookie}, w.dataLayer);
            return w.dataLayer.map((a) => Array.from(a)).filter((c) => c[0] === "consent").map((c) => c[1]);
        };
        expect(run("")).toEqual(["default"]);
        expect(run("cib_consent=analytics:denied")).toEqual(["default"]);
        expect(run("cib_consent=analytics:granted")).toEqual(["default", "update"]);
    });

    it("accept all grants analytics_storage only", () => {
        const gtag = spyGtag();
        consent.saveConsent(consent.ACCEPT_ALL);
        expect(gtag.mock.calls).toEqual([["consent", "update", {analytics_storage: "granted"}]]);
        expect(consent.readConsent()).toEqual({analytics: true});
    });

    it("save choice with analytics on grants it", () => {
        const gtag = spyGtag();
        consent.saveConsent({analytics: true});
        expect(gtag.mock.calls).toEqual([["consent", "update", {analytics_storage: "granted"}]]);
        expect(consent.readConsent()).toEqual({analytics: true});
    });

    it("save choice with analytics off keeps everything denied", () => {
        const gtag = spyGtag();
        document.cookie = "_ga=GA1.1.1; path=/";
        consent.saveConsent({analytics: false});
        expect(gtag.mock.calls).toEqual([["consent", "update", {analytics_storage: "denied"}]]);
        expect(consent.readConsent()).toEqual({analytics: false});
        expect(document.cookie).not.toMatch(/_ga/);
    });

    it("save choice with analytics off after accepting drops GA cookies", () => {
        const gtag = spyGtag();
        document.cookie = "_ga=GA1.1.1; path=/";
        document.cookie = "_ga_TEST=GS1.1; path=/";
        consent.saveConsent({ analytics: false });
        expect(gtag.mock.calls).toEqual([["consent", "update", {analytics_storage: "denied"}]]);
        expect(consent.readConsent()).toEqual({analytics: false});
        expect(document.cookie).not.toMatch(/_ga/);
    });

    it("writes the choice per category to one cookie on the parent domain", () => {
        expect(consent.consentCookie(consent.ACCEPT_ALL, {domain: "cybericebox.com", secure: true}))
            .toBe("cib_consent=analytics:granted; path=/; max-age=31536000; SameSite=Lax; domain=.cybericebox.com; Secure");
        vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "cybericebox.com");
        const writes: string[] = [];
        const spy = vi.spyOn(document, "cookie", "set").mockImplementation((v: string) => { writes.push(v); });
        consent.saveConsent(consent.ACCEPT_ALL);
        spy.mockRestore();
        expect(writes[0]).toMatch(/^cib_consent=analytics:granted; .*domain=\.cybericebox\.com/);
    });

    it("shows the banner only when GA is configured and no choice exists", () => {
        expect(consent.shouldShowBanner("G-TEST", null)).toBe(true);
        expect(consent.shouldShowBanner("G-TEST", {analytics: true})).toBe(false);
        expect(consent.shouldShowBanner("G-TEST", {analytics: false})).toBe(false);
        expect(consent.shouldShowBanner(undefined, null)).toBe(false);
        expect(consent.parseConsent("cib_theme=dark; cib_consent=analytics:granted")).toEqual({analytics: true});
        expect(consent.parseConsent("xcib_consent=analytics:granted")).toBeNull();
    });
});
