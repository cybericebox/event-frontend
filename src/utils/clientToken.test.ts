import {describe, expect, it, vi} from "vitest";
import {createClientToken} from "@/utils/clientToken";

const API = "https://api.example.test";
const TOKEN_URL = `${API}/api/client-token`;
const KEY = "cib_client_token_expires";

function setup(over: {enabled?: boolean; tokenStatus?: number; expires?: string; stored?: string; retryAfter?: string} = {}) {
    let time = 1_000_000;
    const store = new Map<string, string>(over.stored ? [[KEY, over.stored]] : []);
    const calls: string[] = [];
    const execute = vi.fn<(action: string) => Promise<string>>(async () => "captcha-token");
    const api = vi.fn<() => Promise<Response>>(async () => new Response("{}", {status: 200}));
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url === TOKEN_URL) {
            const status = over.tokenStatus ?? 200;
            const headers: Record<string, string> = over.retryAfter ? {"Retry-After": over.retryAfter} : {};
            return new Response(status === 200 ? JSON.stringify({Data: {ExpiresAt: over.expires ?? new Date(time + 24 * 3600_000).toISOString()}}) : "", {status, headers});
        }
        return api();
    }) as unknown as typeof fetch;
    const token = createClientToken({
        enabled: () => over.enabled ?? true, apiOrigin: API, execute, fetchFn,
        storage: () => ({getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v)}),
        now: () => time,
    });
    return {token, execute, api, calls, store, advance: (ms: number) => { time += ms; }, tokenCalls: () => calls.filter(c => c === TOKEN_URL).length};
}

describe("client token", () => {
    it("DOS off: no token request, the call goes straight through", async () => {
        const t = setup({enabled: false});
        await t.token.fetch(`${API}/api/events`);
        expect(t.tokenCalls()).toBe(0);
        expect(t.execute).not.toHaveBeenCalled();
    });

    it("fetches the token once for parallel API calls, with the clientToken action", async () => {
        const t = setup();
        await Promise.all([t.token.fetch(`${API}/api/a`), t.token.fetch(`${API}/api/b`), t.token.fetch(`${API}/api/c`)]);
        expect(t.tokenCalls()).toBe(1);
        expect(t.execute).toHaveBeenCalledWith("clientToken");
        expect(t.calls[0]).toBe(TOKEN_URL);
        expect(t.api).toHaveBeenCalledTimes(3);
        expect(t.store.get(KEY)).toBeTruthy();
    });

    it("does not fetch again while valid, and refreshes inside the 1 minute margin", async () => {
        const t = setup();
        await t.token.fetch(`${API}/api/a`);
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(1);
        t.advance(24 * 3600_000 - 30_000);
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(2);
    });

    it("trusts a stored expiry from an earlier visit", async () => {
        const t = setup({stored: String(1_000_000 + 3600_000)});
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(0);
    });

    it("leaves non-API requests alone", async () => {
        const t = setup();
        await t.token.fetch("https://elsewhere.example.test/api/x");
        await t.token.fetch(`${API}/other`);
        expect(t.tokenCalls()).toBe(0);
    });

    it("retries once after a 429 with X-Client-Token: required, forcing a refresh", async () => {
        const t = setup();
        t.api.mockResolvedValueOnce(new Response("", {status: 429, headers: {"X-Client-Token": "required"}}));
        const response = await t.token.fetch(`${API}/api/a`);
        expect(response.status).toBe(200);
        expect(t.api).toHaveBeenCalledTimes(2);
        expect(t.tokenCalls()).toBe(2);
    });

    it("retries only once when the 429 repeats", async () => {
        const t = setup();
        t.api.mockImplementation(async () => new Response("", {status: 429, headers: {"X-Client-Token": "required"}}));
        const response = await t.token.fetch(`${API}/api/a`);
        expect(response.status).toBe(429);
        expect(t.api).toHaveBeenCalledTimes(2);
    });

    it("does not retry a plain 429 and does not touch the token", async () => {
        const t = setup();
        t.api.mockResolvedValueOnce(new Response("", {status: 429}));
        const response = await t.token.fetch(`${API}/api/a`);
        expect(response.status).toBe(429);
        expect(t.api).toHaveBeenCalledTimes(1);
        expect(t.tokenCalls()).toBe(1);
    });

    it("404 from the token endpoint means DOS is off: remembered, never asked again", async () => {
        const t = setup({tokenStatus: 404});
        await t.token.fetch(`${API}/api/a`);
        t.advance(10 * 60_000);
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(1);
        expect(t.api).toHaveBeenCalledTimes(2);
    });

    it("token endpoint 429: the original request still goes, and the token waits for Retry-After", async () => {
        const t = setup({tokenStatus: 429, retryAfter: "60"});
        await t.token.fetch(`${API}/api/a`);
        expect(t.api).toHaveBeenCalledTimes(1);
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(1);
        t.advance(61_000);
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(2);
    });

    it("a failing captcha never blocks the request", async () => {
        const t = setup();
        t.execute.mockRejectedValueOnce(new Error("blocked"));
        const response = await t.token.fetch(`${API}/api/a`);
        expect(response.status).toBe(200);
        expect(t.tokenCalls()).toBe(0);
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(0);
        t.advance(11_000);
        await t.token.fetch(`${API}/api/a`);
        expect(t.tokenCalls()).toBe(1);
    });
});
