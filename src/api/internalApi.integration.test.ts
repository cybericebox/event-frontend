import {createServer, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {fetchPublic} from "./publicFetch";
import {renderApi} from "./commonPage";
import {serverGet} from "./serverGet";

vi.mock("next/headers", () => ({cookies: vi.fn(), headers: vi.fn()}));

let server: Server;
let origin: string;
let received: {host?: string; origin?: string; authorization?: string; cookie?: string; "x-render-secret"?: string}[];
beforeEach(async () => {
    received = [];
    server = createServer((request, response) => {
        received.push(request.headers);
        if (request.headers.host !== "api.example.test") {
            response.writeHead(404).end();
            return;
        }
        if (request.url === "/api/render/redirect") {
            response.writeHead(307, {Location: `${origin}/redirect-target`}).end();
            return;
        }
        if (request.url === "/slow-body") {
            response.writeHead(200, {"Content-Type": "application/json"});
            response.write("{");
            return;
        }
        if (request.url === "/denied") {
            response.writeHead(503, {"X-Request-ID": "synthetic-request"}).end("unavailable");
            return;
        }
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({Data: "internal API"}));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vi.stubEnv("INTERNAL_API_ORIGIN", origin);
    vi.stubEnv("RENDER_SECRET", "synthetic-render-secret-0123456789abcdef");
});
afterEach(async () => {
    vi.unstubAllEnvs();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

it("preserves the API Host over the internal connection for legacy public reads", async () => {
    const result = await fetchPublic(`${origin}/api/events/self/public-info`, {
        Host: "api.example.test", Origin: "https://event.example.test", Accept: "application/json",
    });
    expect(result).toEqual({status: 200, body: {Data: "internal API"}});
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({host: "api.example.test", origin: "https://event.example.test"});
    expect(received[0].cookie).toBeUndefined();
});

it("preserves the API Host, sends the render secret and no Origin, and forwards only the read grant", async () => {
    const result = await renderApi("/api/render/events/event/manifest", {token: "synthetic-read-grant"});
    expect(result).toMatchObject({status: 200, body: {Data: "internal API"}});
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({host: "api.example.test", authorization: "EventRender synthetic-read-grant", "x-render-secret": "synthetic-render-secret-0123456789abcdef"});
    expect(received[0].origin).toBeUndefined();
    expect(received[0].cookie).toBeUndefined();
});

it("refuses to call the render routes without a configured secret", async () => {
    vi.stubEnv("RENDER_SECRET", "");
    await expect(renderApi("/api/render/key", {})).rejects.toThrow("RENDER_SECRET");
    expect(received).toHaveLength(0);
});

it("coalesces simultaneous public reads over the real internal transport", async () => {
    const results = await Promise.all(Array.from({length: 5}, () => fetchPublic(`${origin}/shared`, {Host: "api.example.test"})));
    expect(results.every(result => result.status === 200)).toBe(true);
    expect(received).toHaveLength(1);
});

it("never sends the render secret to a redirect target", async () => {
    // The target is another origin that records what reaches it.
    const target: Record<string, string | string[] | undefined>[] = [];
    const other = createServer((request, response) => { target.push(request.headers); response.end("{}"); });
    await new Promise<void>(resolve => other.listen(0, "127.0.0.1", resolve));
    const otherOrigin = `http://127.0.0.1:${(other.address() as AddressInfo).port}`;
    server.removeAllListeners("request");
    server.on("request", (request, response) => { received.push(request.headers); response.writeHead(302, {Location: `${otherOrigin}/steal`}).end(); });
    try {
        // Through the internal Host transport (never follows).
        expect(await renderApi("/api/render/redirect", {token: "synthetic-read-grant"})).toMatchObject({status: 502, body: null});
        // Through plain fetch (no Host override): the redirect must be left unfollowed.
        vi.stubEnv("INTERNAL_API_ORIGIN", origin);
        const realFetch = globalThis.fetch;
        const seen: RequestInit[] = [];
        vi.stubGlobal("fetch", (url: string, init: RequestInit) => { seen.push(init); return realFetch(url, init); });
        const { serverGet: get } = await import("./serverGet");
        const response = await get(`${origin}/api/render/redirect`, {"X-Render-Secret": "s"}, AbortSignal.timeout(5000), true);
        expect(response.status).toBe(302);
        expect(seen[0].redirect).toBe("manual");
        expect(target).toHaveLength(0);
    } finally {
        vi.unstubAllGlobals();
        await new Promise<void>(resolve => other.close(() => resolve()));
    }
});

it("refuses to attach the render secret to a URL outside the API origin or the render routes", async () => {
    await expect(renderApi("/other/path", {})).rejects.toThrow("refused");
    await expect(renderApi("@evil.test/api/render/key", {})).rejects.toThrow();
    expect(received).toHaveLength(0);
});

it("preserves denial status and request IDs without caching a failure", async () => {
    for (let i = 0; i < 2; i++) {
        await expect(fetchPublic(`${origin}/denied`, {Host: "api.example.test"})).resolves.toEqual({status: 503, body: null, requestId: "synthetic-request"});
    }
    expect(received).toHaveLength(2);
});

it("aborts an internal response body after headers have arrived", async () => {
    const controller = new AbortController();
    const response = await serverGet(`${origin}/slow-body`, {Host: "api.example.test"}, controller.signal);
    const body = response.text();
    controller.abort();
    await expect(body).rejects.toThrow();
});
