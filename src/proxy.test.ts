import {NextRequest} from "next/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const read = vi.hoisted(() => vi.fn());
vi.mock("@/api/publicFetch", () => ({fetchPublic: read}));

import {proxy} from "./proxy";

let counter = 0;
const request = (host: string, path = "/") => new NextRequest(`https://${host}${path}`, {headers: {host}});
const host = () => `h${++counter}.example.test`;

beforeEach(() => {read.mockReset();});
afterEach(() => {vi.clearAllMocks();});

describe("event site status", () => {
    it("answers 404 for an unknown host on every route", async () => {
        const h = host();
        read.mockResolvedValue({status: 404, body: null});
        for (const path of ["/", "/faq", "/p/rules", "/scoreboard"]) expect((await proxy(request(h, path))).status).toBe(404);
    });
    it("answers 404 for a hidden event read anonymously (the API gives the same 404)", async () => {
        read.mockResolvedValue({status: 404, body: null});
        expect((await proxy(request(host()))).status).toBe(404);
    });
    it("answers 200 for a public event landing", async () => {
        read.mockResolvedValue({status: 200, body: {}});
        expect((await proxy(request(host()))).status).toBe(200);
    });
    it("keeps 200 when the API is unreachable or fails", async () => {
        read.mockRejectedValueOnce(new Error("down"));
        expect((await proxy(request(host()))).status).toBe(200);
        read.mockResolvedValueOnce({status: 503, body: null});
        expect((await proxy(request(host()))).status).toBe(200);
    });
    it("remembers an unknown host for the negative window without asking the API again", async () => {
        const h = host();
        read.mockResolvedValue({status: 404, body: null});
        await proxy(request(h));
        await proxy(request(h, "/faq"));
        expect(read).toHaveBeenCalledTimes(1);
    });
    it("asks the API at most once for a known public host within the window", async () => {
        const h = host();
        read.mockResolvedValue({status: 200, body: {}});
        for (let i = 0; i < 25; i++) expect((await proxy(request(h, i % 2 ? "/" : "/faq"))).status).toBe(200);
        expect(read).toHaveBeenCalledTimes(1);
    });
    it("does not turn a sign-in-gated answer (401/403) into a 404", async () => {
        for (const status of [401, 403]) {
            read.mockResolvedValueOnce({status, body: null});
            expect((await proxy(request(host(), "/team"))).status).toBe(200);
        }
    });
    it("rewrites to the origin the server itself listens on, never to the public host", async () => {
        vi.stubEnv("HOSTNAME", "127.0.0.1");
        vi.stubEnv("PORT", "3001");
        read.mockResolvedValue({status: 404, body: null});
        const response = await proxy(new NextRequest("https://a.example.test/faq?x=1", {headers: {host: host(), "x-forwarded-proto": "https"}}));
        expect(response.headers.get("x-middleware-rewrite")).toBe("https://127.0.0.1:3001/faq?x=1");
        vi.unstubAllEnvs();
    });
    it("still sets the CSP and nonce on a 404", async () => {
        read.mockResolvedValue({status: 404, body: null});
        const response = await proxy(request(host()));
        expect(response.headers.get("Content-Security-Policy")).toContain("nonce-");
    });
});
