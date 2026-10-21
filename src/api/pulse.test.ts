import {afterEach, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));
const {getPulse} = await import("./pulse");

afterEach(() => vi.unstubAllGlobals());

it("asks for the site and event with the session, never bypassing the ETag cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: {Banners: "v1", Inbox: {Cursor: "c", Unread: 2}}})));
    vi.stubGlobal("fetch", fetcher);
    expect(await getPulse("e1")).toEqual({Banners: "v1", Inbox: {Cursor: "c", Unread: 2}});
    expect(fetcher.mock.calls[0][0]).toBe("https://api.test/api/notifications/pulse?site=event&event=e1");
    expect(fetcher.mock.calls[0][1]).toMatchObject({credentials: "include"});
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("cache");
});

it("reads a guest's null inbox and rejects a failed answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: {Banners: "v1", Inbox: null}}))));
    expect((await getPulse("e1")).Inbox).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {status: 503})));
    await expect(getPulse("e1")).rejects.toThrow();
});
