// Analytics consent (Google Consent Mode v2): denied by default, accept grants analytics only,
// the choice is one cookie on the parent domain, the banner asks only when needed.
// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import * as consent from "./consent";

function clearCookies() {
    for (const name of document.cookie.split("; ").map((c) => c.split("=")[0]).filter(Boolean)) document.cookie = `${name}=; path=/; max-age=0`;
}

afterEach(() => {
    clearCookies();
    vi.unstubAllEnvs();
    delete (window as {gtag?: unknown}).gtag;
});

describe("consent", () => {
    it("defaults every Consent Mode signal to denied, before config", () => {
        expect(consent.CONSENT_DEFAULTS).toEqual({analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"});
        const boot = consent.gtagBootScript("G-TEST");
        expect(boot.indexOf('"consent","default"')).toBeLessThan(boot.indexOf('"config"'));
    });

    it("accept grants analytics_storage only", () => {
        const gtag = vi.fn();
        (window as {gtag?: unknown}).gtag = gtag;
        consent.saveConsent("granted");
        expect(gtag.mock.calls).toEqual([["consent", "update", {analytics_storage: "granted"}]]);
        expect(consent.readConsent()).toBe("granted");
    });

    it("reject keeps everything denied and drops GA cookies", () => {
        const gtag = vi.fn();
        (window as {gtag?: unknown}).gtag = gtag;
        document.cookie = "_ga=GA1.1.1; path=/";
        document.cookie = "_ga_TEST=GS1.1; path=/";
        consent.saveConsent("denied");
        expect(gtag.mock.calls).toEqual([["consent", "update", {analytics_storage: "denied"}]]);
        expect(consent.readConsent()).toBe("denied");
        expect(document.cookie).not.toMatch(/_ga/);
    });

    it("writes the choice to one cookie on the parent domain", () => {
        expect(consent.consentCookie("granted", {domain: "cybericebox.com", secure: true}))
            .toBe("cib_consent=granted; path=/; max-age=31536000; SameSite=Lax; domain=.cybericebox.com; Secure");
        vi.stubEnv("NEXT_PUBLIC_DOMAIN", "cybericebox.com");
        const writes: string[] = [];
        const spy = vi.spyOn(document, "cookie", "set").mockImplementation((v: string) => { writes.push(v); });
        consent.saveConsent("granted");
        spy.mockRestore();
        expect(writes[0]).toMatch(/^cib_consent=granted; .*domain=\.cybericebox\.com/);
    });

    it("shows the banner only when GA is configured and no choice exists", () => {
        expect(consent.shouldShowBanner("G-TEST", null)).toBe(true);
        expect(consent.shouldShowBanner("G-TEST", "granted")).toBe(false);
        expect(consent.shouldShowBanner("G-TEST", "denied")).toBe(false);
        expect(consent.shouldShowBanner(undefined, null)).toBe(false);
        expect(consent.parseConsent("ib_theme=dark; cib_consent=granted")).toBe("granted");
        expect(consent.parseConsent("xcib_consent=granted")).toBeNull();
    });
});
