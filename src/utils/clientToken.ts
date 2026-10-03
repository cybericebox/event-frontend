// Client token (anti-abuse): with DOS protection on, the first visit passes an invisible check of the configured
// provider and the API sets the HttpOnly `__Host-client` cookie. Every browser request to the API awaits
// ensureClientToken() first; an `X-Client-Token: required` 429 forces one refresh and one retry.
import {dosProtectionEnabled, executeCaptcha} from "@/utils/captcha";
import {STORAGE_CLIENT_TOKEN_EXPIRES} from "@/utils/storageKeys";
import {apiOrigin} from "@/utils/origins";

const REFRESH_MARGIN_MS = 60_000;
const DEFAULT_BACKOFF_MS = 30_000;
const FAILURE_BACKOFF_MS = 10_000;
const MAX_BACKOFF_MS = 10 * 60_000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type ClientTokenOptions = {
    enabled: () => boolean;
    apiOrigin: string;
    execute: (action: string) => Promise<string>;
    fetchFn: typeof fetch;
    storage?: () => StorageLike | null;
    now?: () => number;
};

export type ClientToken = {
    ensure(force?: boolean): Promise<void>;
    fetch: typeof fetch;
};

function browserStorage(): StorageLike | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
        return null;
    }
}

export function createClientToken(options: ClientTokenOptions): ClientToken {
    const now = options.now ?? Date.now;
    const storage = options.storage ?? browserStorage;
    const tokenUrl = `${options.apiOrigin}/api/client-token`;
    const apiPrefix = `${options.apiOrigin}/api/`;
    let inflight: Promise<void> | null = null;
    let off = false;
    let backoffUntil = 0;
    let expiresAt = 0;

    const readExpiry = (): number => {
        if (expiresAt) return expiresAt;
        try {
            const parsed = Number(storage()?.getItem(STORAGE_CLIENT_TOKEN_EXPIRES));
            if (Number.isFinite(parsed)) expiresAt = parsed;
        } catch { /* storage is a convenience only */ }
        return expiresAt;
    };
    const writeExpiry = (value: number) => {
        expiresAt = value;
        try { storage()?.setItem(STORAGE_CLIENT_TOKEN_EXPIRES, String(value)); } catch { /* ignore */ }
    };
    const backoff = (ms: number) => { backoffUntil = now() + Math.min(ms, MAX_BACKOFF_MS); };

    async function request(): Promise<void> {
        try {
            const token = await options.execute("clientToken");
            const response = await options.fetchFn(tokenUrl, {
                method: "POST", credentials: "include", cache: "no-store",
                headers: {"Content-Type": "application/json", Accept: "application/json"},
                body: JSON.stringify({RecaptchaToken: token}),
            });
            if (response.status === 404) { off = true; return; }
            if (response.status === 429) {
                const seconds = Number(response.headers.get("Retry-After"));
                backoff(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_BACKOFF_MS);
                return;
            }
            if (!response.ok) { backoff(FAILURE_BACKOFF_MS); return; }
            const body = await response.json() as {Data?: {ExpiresAt?: string}};
            const at = Date.parse(body.Data?.ExpiresAt ?? "");
            writeExpiry(Number.isFinite(at) ? at : now() + 60 * 60_000);
        } catch {
            // Never block the page: the original request goes out and shows its own error.
            backoff(FAILURE_BACKOFF_MS);
        }
    }

    function ensure(force = false): Promise<void> {
        if (!options.enabled() || off) return Promise.resolve();
        if (inflight) return inflight;
        if (!force && readExpiry() - now() > REFRESH_MARGIN_MS) return Promise.resolve();
        if (now() < backoffUntil) return Promise.resolve();
        inflight = request().finally(() => { inflight = null; });
        return inflight;
    }

    const targetsApi = (input: RequestInfo | URL): boolean => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        return url.startsWith(apiPrefix) && !url.startsWith(`${tokenUrl}`);
    };

    const wrapped: typeof fetch = async (input, init) => {
        if (!options.enabled() || off || !targetsApi(input)) return options.fetchFn(input, init);
        // A Request body can be read once; keep a copy for the retry.
        const spare = input instanceof Request ? input.clone() : input;
        await ensure();
        const response = await options.fetchFn(input, init);
        if (response.status === 429 && response.headers.get("X-Client-Token") === "required") {
            await ensure(true);
            return options.fetchFn(spare, init);
        }
        return response;
    };

    return {ensure, fetch: wrapped};
}

let installed: ClientToken | null = null;

// Wraps window.fetch once so every browser call to the API goes through the client token. A no-op on the server
// and when DOS protection is off.
export function installClientToken(): ClientToken | null {
    if (typeof window === "undefined" || installed) return installed;
    const original = window.fetch.bind(window);
    installed = createClientToken({enabled: dosProtectionEnabled, apiOrigin, execute: action => executeCaptcha(action), fetchFn: original});
    window.fetch = installed.fetch;
    return installed;
}

export function ensureClientToken(force = false): Promise<void> {
    return (installed ?? installClientToken())?.ensure(force) ?? Promise.resolve();
}
