// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.example.test"}));
import {signOut} from "./authAPI";
import {readCachedLogo, writeCachedBrand} from "@/utils/eventBrandCache";

beforeEach(() => {window.localStorage.clear();});
afterEach(() => {vi.unstubAllGlobals();});

it("deletes the read session and the remembered branding when signing out", async () => {
    writeCachedBrand({logo: "https://api.example.test/logo/a", favicon: "https://api.example.test/fav/a"});
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {calls.push(`${init?.method} ${url}`); return new Response(null, {status: 204});}));
    await signOut();
    expect(calls).toEqual(["POST https://api.example.test/api/auth/sign-out", "DELETE /api/event-session"]);
    expect(readCachedLogo()).toBeNull();
    expect(window.localStorage.length).toBe(0);
});

it("still signs out when the session cleanup request fails", async () => {
    const fetcher = vi.fn(async (url: string) => {
        if (url === "/api/event-session") throw new TypeError("offline");
        return new Response(null, {status: 204});
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(signOut()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
});

it("reports a failed sign-out", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(null, {status: url === "/api/event-session" ? 204 : 500})));
    await expect(signOut()).rejects.toThrow("Sign-out failed");
});
