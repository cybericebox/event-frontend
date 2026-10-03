// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {executeCaptcha, NO_CAPTCHA_TOKEN, normalizeProvider, resetCaptchaScriptsForTests} from "@/utils/captcha";

type W = Window & {turnstile?: unknown; grecaptcha?: unknown};
const w = window as W;

// jsdom does not run external scripts: fire onload ourselves and record the src.
function autoLoadScripts(): string[] {
    const srcs: string[] = [];
    vi.spyOn(document.head, "appendChild").mockImplementation(node => {
        const el = node as HTMLScriptElement;
        srcs.push(el.src);
        queueMicrotask(() => el.onload?.(new Event("load")));
        return node;
    });
    return srcs;
}

beforeEach(() => resetCaptchaScriptsForTests());
afterEach(() => {
    vi.restoreAllMocks();
    delete w.turnstile;
    delete w.grecaptcha;
    document.body.innerHTML = "";
});

describe("normalizeProvider", () => {
    it("knows turnstile and recaptcha, everything else is none", () => {
        expect(normalizeProvider("turnstile")).toBe("turnstile");
        expect(normalizeProvider(" recaptcha ")).toBe("recaptcha");
        for (const v of ["none", "", undefined, "hcaptcha"]) expect(normalizeProvider(v)).toBe("none");
    });
});

describe("executeCaptcha", () => {
    it("none: dummy token, nothing loaded", async () => {
        const srcs = autoLoadScripts();
        expect(await executeCaptcha("signIn", {provider: "none", siteKey: "", enterprise: false})).toBe(NO_CAPTCHA_TOKEN);
        expect(srcs).toEqual([]);
    });

    it("requires a site key for a real provider", async () => {
        await expect(executeCaptcha("clientToken", {provider: "turnstile", siteKey: "", enterprise: false})).rejects.toThrow(/SITE_KEY/);
    });

    it("turnstile: loads the script once, renders an interaction-only widget with the action, removes it", async () => {
        const srcs = autoLoadScripts();
        const remove = vi.fn();
        let options: Record<string, unknown> = {};
        w.turnstile = {
            render: (_c: HTMLElement, o: Record<string, unknown>) => { options = o; return "wid"; },
            execute: () => (options.callback as (t: string) => void)("ts-token"),
            remove,
        };
        const config = {provider: "turnstile" as const, siteKey: "SK", enterprise: false};
        expect(await executeCaptcha("clientToken", config)).toBe("ts-token");
        expect(await executeCaptcha("clientToken", config)).toBe("ts-token");
        expect(srcs).toEqual(["https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]);
        expect(options).toMatchObject({sitekey: "SK", action: "clientToken", appearance: "interaction-only", execution: "execute"});
        expect(remove).toHaveBeenCalledWith("wid");
        expect(document.body.children.length).toBe(0);
    });

    it("recaptcha: v3 script, execute with the action", async () => {
        const srcs = autoLoadScripts();
        const execute = vi.fn().mockResolvedValue("rc-token");
        w.grecaptcha = {ready: (cb: () => void) => cb(), execute};
        expect(await executeCaptcha("signIn", {provider: "recaptcha", siteKey: "K", enterprise: false})).toBe("rc-token");
        expect(srcs).toEqual(["https://www.google.com/recaptcha/api.js?render=K"]);
        expect(execute).toHaveBeenCalledWith("K", {action: "signIn"});
    });

    it("recaptcha enterprise: enterprise.js and grecaptcha.enterprise", async () => {
        const srcs = autoLoadScripts();
        const execute = vi.fn().mockResolvedValue("ent-token");
        w.grecaptcha = {enterprise: {ready: (cb: () => void) => cb(), execute}};
        expect(await executeCaptcha("clientToken", {provider: "recaptcha", siteKey: "K", enterprise: true})).toBe("ent-token");
        expect(srcs).toEqual(["https://www.google.com/recaptcha/enterprise.js?render=K"]);
    });
});
