import {afterEach, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
import {getResultsFreeze} from "./manageResults";
import {ManageApiError} from "./manage";

afterEach(() => vi.unstubAllGlobals());

it("reads only the freeze state with the caller's session", async () => {
    const freeze = {Enabled: true, FrozenAt: "2026-10-21T08:00:00Z", FinishAt: "2026-10-21T09:00:00Z", OpenedAt: null,
        Active: true, Applied: true, BannerText: "До нагородження", BannerLevel: "critical"};
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: freeze})));
    vi.stubGlobal("fetch", fetcher);
    expect(await getResultsFreeze("event /1")).toEqual(freeze);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://api.test/api/events/event%20%2F1/results/freeze", expect.objectContaining({credentials: "include", cache: "no-store"}));
});

it.each([401, 403, 404, 503])("preserves HTTP %i for the banner's access and retry policy", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {status})));
    await expect(getResultsFreeze("event-1")).rejects.toMatchObject({status});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {status})));
    await expect(getResultsFreeze("event-1")).rejects.toBeInstanceOf(ManageApiError);
});
