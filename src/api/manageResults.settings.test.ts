import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("@/utils/origins", () => ({apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
import {freezeSchema, getResultsSettings, putResultsSettings, resultsSettingsInput} from "./manageResults";

afterEach(() => vi.unstubAllGlobals());

const settings = {ScoreboardVisibility: 1, FreezeEnabled: true, FreezeMinutes: 30, LiveFreeze: true,
    ChartEnabled: true, ChartTeams: 5, RowsLimit: null, OpenedAt: null,
    Freeze: {Enabled: true, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false}};

describe("results freeze ending settings", () => {
    it.each([
        [undefined, "at_finish"],
        ["at_finish", "at_finish"],
        ["manual", "manual"],
    ])("preserves mode %s as %s in the full save payload", async (received, expected) => {
        const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({Data: {...settings, FreezeEndMode: received}})));
        vi.stubGlobal("fetch", fetcher);
        const result = await getResultsSettings("event-1");
        expect(result).toMatchObject({FreezeEndMode: expected, FreezeBannerText: "", FreezeBannerLevel: "warning"});
        await putResultsSettings("event-1", resultsSettingsInput(result));
        expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
            ScoreboardVisibility: 1, FreezeEnabled: true, FreezeMinutes: 30, FreezeEndMode: expected,
            FreezeBannerText: "", FreezeBannerLevel: "warning",
            LiveFreeze: true, ChartEnabled: true, ChartTeams: 5, RowsLimit: null,
        });
    });

    it("rejects an unsupported freeze ending mode", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: {...settings, FreezeEndMode: "other"}}))));
        await expect(getResultsSettings("event-1")).rejects.toThrow();
    });

    it.each(["info", "warning", "critical"])("preserves authored banner text and %s style in the full save payload", async level => {
        const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({Data: {...settings, FreezeEndMode: "manual", FreezeBannerText: "До церемонії нагородження", FreezeBannerLevel: level}})));
        vi.stubGlobal("fetch", fetcher);
        const result = await getResultsSettings("event-1");
        await putResultsSettings("event-1", resultsSettingsInput(result));
        expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({FreezeEndMode: "manual", FreezeBannerText: "До церемонії нагородження", FreezeBannerLevel: level});
    });

    it("defaults public freeze banner data and preserves its configured text and style", () => {
        expect(freezeSchema.parse(settings.Freeze)).toMatchObject({BannerText: "", BannerLevel: "warning"});
        expect(freezeSchema.parse({...settings.Freeze, BannerText: "Зачекайте на фінал", BannerLevel: "critical"})).toMatchObject({BannerText: "Зачекайте на фінал", BannerLevel: "critical"});
    });

    it("rejects an unsupported banner style", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: {...settings, FreezeBannerLevel: "other"}}))));
        await expect(getResultsSettings("event-1")).rejects.toThrow();
    });
});
