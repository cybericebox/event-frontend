import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));
import {ClientEventInfoError, getClientEventInfo} from "./clientEventInfo";

afterEach(() => vi.unstubAllGlobals());

describe("getClientEventInfo", () => {
    it("a refused CORS read of a reachable API is a real 404 (unknown event address)", async () => {
        vi.stubGlobal("fetch", vi.fn((_: string, init?: RequestInit) => init?.mode === "no-cors" ? Promise.resolve(new Response("")) : Promise.reject(new TypeError("Failed to fetch"))));
        await expect(getClientEventInfo()).rejects.toMatchObject({status: 404});
    });

    it("a network failure with the API not answering stays a network error (outage)", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
        await expect(getClientEventInfo()).rejects.toBeInstanceOf(TypeError);
    });

    it("a 5xx carries X-Request-ID", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("", {status: 500, headers: {"X-Request-ID": "abc"}}))));
        await expect(getClientEventInfo()).rejects.toEqual(expect.objectContaining({status: 500, requestId: "abc"}));
        await expect(getClientEventInfo()).rejects.toBeInstanceOf(ClientEventInfoError);
    });
});
