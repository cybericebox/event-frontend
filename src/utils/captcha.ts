// Bot-check helper: loads the configured provider's script once and executes an action.
// NEXT_PUBLIC_* are placeholders baked at build and substituted at container start, so a value is never
// compared with `=== "literal"` (the build would fold it); membership in a list is used instead.
// Each variable is read as a plain `process.env.NEXT_PUBLIC_X` expression, the only form Next inlines.

export type CaptchaProvider = "turnstile" | "recaptcha" | "none";

export type CaptchaConfig = {provider: CaptchaProvider; siteKey: string; enterprise: boolean};

// The token sent when no provider is configured (local development and tests).
export const NO_CAPTCHA_TOKEN = "none";

export function normalizeProvider(value: string | undefined): CaptchaProvider {
    const v = (value ?? "").trim();
    if (["turnstile"].includes(v)) return "turnstile";
    if (["recaptcha"].includes(v)) return "recaptcha";
    return "none";
}

export function readCaptchaConfig(): CaptchaConfig {
    return {
        provider: normalizeProvider(process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER),
        siteKey: (process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ?? "").trim(),
        enterprise: ["true"].includes((process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE ?? "").trim()),
    };
}

export function dosProtectionEnabled(): boolean {
    return ["on"].includes((process.env.NEXT_PUBLIC_DOS_PROTECTION ?? "").trim());
}

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const RECAPTCHA_SRC = "https://www.google.com/recaptcha/api.js?render=";
const RECAPTCHA_ENTERPRISE_SRC = "https://www.google.com/recaptcha/enterprise.js?render=";
const EXECUTE_TIMEOUT_MS = 20_000;

type TurnstileApi = {
    render(container: HTMLElement, options: Record<string, unknown>): string;
    execute(container: HTMLElement | string): void;
    remove(widgetId: string): void;
};
type RecaptchaApi = {ready(callback: () => void): void; execute(siteKey: string, options: {action: string}): Promise<string>};
type CaptchaWindow = Window & {turnstile?: TurnstileApi; grecaptcha?: RecaptchaApi & {enterprise?: RecaptchaApi}};

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
    const known = scripts.get(src);
    if (known) return known;
    const loading = new Promise<void>((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src;
        el.async = true;
        el.defer = true;
        el.onload = () => resolve();
        el.onerror = () => {
            // A failed load can be retried by the next call.
            scripts.delete(src);
            el.remove();
            reject(new Error("captcha script failed to load"));
        };
        document.head.appendChild(el);
    });
    scripts.set(src, loading);
    return loading;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("captcha timed out")), ms);
        promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
}

async function executeTurnstile(siteKey: string, action: string): Promise<string> {
    await loadScript(TURNSTILE_SRC);
    const api = (window as CaptchaWindow).turnstile;
    if (!api) throw new Error("turnstile unavailable");
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483647";
    document.body.appendChild(container);
    let widgetId: string | null = null;
    try {
        return await withTimeout(new Promise<string>((resolve, reject) => {
            widgetId = api.render(container, {
                sitekey: siteKey,
                action,
                appearance: "interaction-only",
                execution: "execute",
                callback: (token: string) => resolve(token),
                "error-callback": () => reject(new Error("turnstile failed")),
                "timeout-callback": () => reject(new Error("turnstile timed out")),
            });
            api.execute(container);
        }), EXECUTE_TIMEOUT_MS);
    } finally {
        if (widgetId !== null) {
            try { api.remove(widgetId); } catch { /* the widget is gone already */ }
        }
        container.remove();
    }
}

async function executeRecaptcha(siteKey: string, enterprise: boolean, action: string): Promise<string> {
    await loadScript(`${enterprise ? RECAPTCHA_ENTERPRISE_SRC : RECAPTCHA_SRC}${encodeURIComponent(siteKey)}`);
    const root = (window as CaptchaWindow).grecaptcha;
    const api = enterprise ? root?.enterprise : root;
    if (!api) throw new Error("recaptcha unavailable");
    return withTimeout(new Promise<string>((resolve, reject) => {
        api.ready(() => { api.execute(siteKey, {action}).then(resolve, reject); });
    }), EXECUTE_TIMEOUT_MS);
}

// Runs the configured provider for `action` (signIn, signUp, forgotPassword, clientToken) and resolves with the token.
// The token goes to the API in the JSON field `RecaptchaToken` for every provider.
export async function executeCaptcha(action: string, config: CaptchaConfig = readCaptchaConfig()): Promise<string> {
    if (config.provider === "none") return NO_CAPTCHA_TOKEN;
    if (!config.siteKey) throw new Error("NEXT_PUBLIC_CAPTCHA_SITE_KEY is required");
    if (config.provider === "turnstile") return executeTurnstile(config.siteKey, action);
    return executeRecaptcha(config.siteKey, config.enterprise, action);
}

// Test hook: forget the loaded scripts.
export function resetCaptchaScriptsForTests(): void {
    scripts.clear();
}
