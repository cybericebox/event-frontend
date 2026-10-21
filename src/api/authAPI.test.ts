// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://event.test/"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.example.test"}));
import {signOut} from "./authAPI";
import {readPreviewCookie, setPreviewCookie} from "@/utils/previewCookie";
import {readCachedLogo, writeCachedBrand} from "@/utils/eventBrandCache";

beforeEach(() => {window.localStorage.clear(); window.sessionStorage.clear(); document.cookie = "cib_participant_preview=; Path=/; Max-Age=0";});
afterEach(() => {vi.unstubAllGlobals();});

it("deletes the read session and the remembered branding when signing out", async () => {
    writeCachedBrand({logo: "https://api.example.test/logo/a", favicon: "https://api.example.test/fav/a"});
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {calls.push(`${init?.method} ${url}`); return new Response(null, {status: 204});}));
    await signOut();
    expect(calls).toEqual(["POST https://api.example.test/api/auth/sign-out", "DELETE /api/event-session"]);
    expect(readCachedLogo()).toBeNull();
    expect(Object.keys(window.localStorage).filter(key => key !== "event-participant-preview-v1")).toEqual([]);
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

it("clears the participant preview cookie when signing out", async () => {
    setPreviewCookie("event-1");
    expect(readPreviewCookie()).toBe("event-1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {status: 204})));
    await signOut();
    expect(readPreviewCookie()).toBeNull();
});


it("forgets durable and legacy test state only after a successful explicit sign-out", async () => {
    const key = "event-participant-preview-v1";
    localStorage.setItem(key, JSON.stringify({userID: "user-1"}));
    sessionStorage.setItem(key, JSON.stringify({userID: "user-1"}));
    setPreviewCookie("event-1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {status: 204})));
    await signOut();
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(readPreviewCookie()).toBeNull();
});

it("keeps test state and its cookie when explicit sign-out fails", async () => {
    const key = "event-participant-preview-v1";
    localStorage.setItem(key, "saved-preview");
    setPreviewCookie("event-1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {status: 500})));
    await expect(signOut()).rejects.toThrow("Sign-out failed");
    expect(localStorage.getItem(key)).toBe("saved-preview");
    expect(readPreviewCookie()).toBe("event-1");
});
