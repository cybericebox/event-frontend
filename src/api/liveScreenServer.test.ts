import {afterEach, describe, expect, it, vi} from "vitest";
import {defaultLiveLayout} from "./manageLive";

const get = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({headers: async () => new Headers({host: "krctf.example.test"})}));
vi.mock("./serverGet", () => ({serverGet: get}));

const {getLiveScreenStart} = await import("./liveScreenServer");

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "krctf", Name: "Захід", StartTime: "2026-10-20T08:00:00Z", FinishTime: null, Status: 2,
    Participation: 1, Registration: 1, CanViewResults: true, CanViewParticipants: true, PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    Theme: {Brand: "#123456", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
};
const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});

afterEach(() => {get.mockReset();});

describe("the server read of a screen link", () => {
    it("sends the token in a header, never in the URL, as the event site", async () => {
        get.mockResolvedValue(json(200, {Data: {Event: event, Layout: defaultLiveLayout, Stages: []}}));
        const start = await getLiveScreenStart("secret-token");
        expect(start.kind).toBe("ok");
        const [url, headers] = get.mock.calls[0] as [string, Record<string, string>];
        expect(url).not.toContain("secret-token");
        expect(new URL(url).search).toBe("");
        expect(headers["X-Live-Screen-Token"]).toBe("secret-token");
        expect(headers.Origin).toBe("https://krctf.example.test");
    });

    it("tells a closed link, a missing event and a temporary failure apart", async () => {
        get.mockResolvedValueOnce(json(403));
        expect(await getLiveScreenStart("a")).toEqual({kind: "closed"});
        get.mockResolvedValueOnce(json(404));
        expect(await getLiveScreenStart("b")).toEqual({kind: "notFound"});
        get.mockResolvedValueOnce(json(502));
        expect(await getLiveScreenStart("c")).toEqual({kind: "failed"});
        get.mockRejectedValueOnce(new Error("down"));
        expect(await getLiveScreenStart("d")).toEqual({kind: "failed"});
    });
});
