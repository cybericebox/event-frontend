import {createServer, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {fetchPublic} from "./publicFetch";
import {renderApi} from "./commonPage";
import {serverGet} from "./serverGet";

vi.mock("next/headers", () => ({cookies: vi.fn(), headers: vi.fn()}));

let server: Server;
let origin: string;
let received: {host?: string; origin?: string; authorization?: string; cookie?: string}[];
beforeEach(async () => {
    received = [];
    server = createServer((request, response) => {
        received.push(request.headers);
        if (request.headers.host !== "api.example.test") {
            response.writeHead(404).end();
            return;
        }
        if (request.url === "/redirect") {
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

it("preserves API Host and event Origin for common pages and forwards only the read grant", async () => {
    const result = await renderApi("/api/events/self/render-manifest", {
        origin: "https://event.example.test", token: "synthetic-read-grant",
    });
    expect(result).toMatchObject({status: 200, body: {Data: "internal API"}});
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({host: "api.example.test", origin: "https://event.example.test", authorization: "EventRender synthetic-read-grant"});
    expect(received[0].cookie).toBeUndefined();
});

it("coalesces simultaneous public reads over the real internal transport", async () => {
    const results = await Promise.all(Array.from({length: 5}, () => fetchPublic(`${origin}/shared`, {Host: "api.example.test"})));
    expect(results.every(result => result.status === 200)).toBe(true);
    expect(received).toHaveLength(1);
});

it("does not follow an internal redirect with the read grant", async () => {
    const result = await renderApi("/redirect", {origin: "https://event.example.test", token: "synthetic-read-grant"});
    expect(result).toMatchObject({status: 307, body: null});
    expect(received).toHaveLength(1);
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
