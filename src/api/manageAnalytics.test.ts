import {afterEach, describe, expect, it, vi} from "vitest";
vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));
import {ManageApiError} from "./manage";
import {analyticsExportPath, AnalyticsOverviewSchema, getAnalyticsAccess, getAnalyticsOverview, periodQuery} from "./manageAnalytics";

afterEach(() => vi.unstubAllGlobals());

const eventID = "01900000-0000-7000-8000-000000000001";
const overview = {
    Participants: {Registered: 12, Approved: 10, Pending: 1, Invited: 1, Active: 4},
    Teams: {Total: 5, Admitted: 3, Incomplete: 2},
    Attempts: 40, Correct: 7, Solves: 6, HintsOpened: 2, HintPoints: 30,
    Stands: {Creating: 0, Ready: 3, Failed: 1},
    Series: [{At: "2026-09-29T10:00:00Z", Attempts: 3, Correct: 1, Solves: 1, Opens: 2}],
    Feed: [{Kind: "first_blood", At: "2026-09-29T10:04:00Z", TeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue", ChallengeName: "Web 1", Detail: ""}],
    Markers: {StartAt: "2026-09-29T10:00:00Z", FreezeAt: null, FinishAt: "2026-09-29T14:00:00Z"},
    Period: {From: "2026-09-29T10:00:00Z", To: "2026-09-29T10:05:00Z"},
    RefreshedAt: null, Final: false,
};

describe("analytics API", () => {
    it("builds the period query only from the bounds that are set", () => {
        expect(periodQuery({from: null, to: null})).toBe("");
        expect(periodQuery({from: "2026-09-29T10:00:00.000Z", to: null})).toBe("?from=2026-09-29T10%3A00%3A00.000Z");
        expect(analyticsExportPath("tasks", {from: null, to: "2026-09-29T12:00:00.000Z"})).toBe("analytics/tasks/export.csv?to=2026-09-29T12%3A00%3A00.000Z");
    });

    it("parses the overview and tolerates a null series and feed", () => {
        expect(AnalyticsOverviewSchema.parse(overview).Feed[0]).toMatchObject({Kind: "first_blood", TeamName: "Blue"});
        const empty = AnalyticsOverviewSchema.parse({...overview, Series: null, Feed: null});
        expect(empty.Series).toEqual([]);
        expect(empty.Feed).toEqual([]);
    });

    it("rejects an unknown feed kind", () => {
        expect(AnalyticsOverviewSchema.safeParse({...overview, Feed: [{...overview.Feed[0], Kind: "other"}]}).success).toBe(false);
    });

    it("requests the overview of a period with the session", async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: overview}), {status: 200}));
        vi.stubGlobal("fetch", fetcher);
        const value = await getAnalyticsOverview(eventID, {from: "2026-09-29T10:00:00.000Z", to: null});
        expect(fetcher.mock.calls[0][0]).toBe(`https://api.example.org/api/events/${eventID}/manage/analytics/overview?from=2026-09-29T10%3A00%3A00.000Z`);
        expect(fetcher.mock.calls[0][1]).toMatchObject({credentials: "include"});
        expect(value.Attempts).toBe(40);
    });

    it("reads the access and raises the API error of a denied request", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({Data: {Sections: true, Sensitive: false}}), {status: 200})));
        expect(await getAnalyticsAccess(eventID)).toEqual({Sections: true, Sensitive: false});
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({Status: {Code: 62201}}), {status: 403})));
        await expect(getAnalyticsAccess(eventID)).rejects.toBeInstanceOf(ManageApiError);
    });
});
