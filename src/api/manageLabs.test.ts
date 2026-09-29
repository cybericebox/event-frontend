import {afterEach, describe, expect, it, vi} from "vitest";
import {ManageApiError} from "./manage";
vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));
import {ManageLabsSchema, ModeratorChallengeSchema, getManageLabs, isInfrastructureNotAllowed, putManageLabsSettings, recreateStand, standErrorMessage} from "./manageLabs";

afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals();});

const eventID = "01900000-0000-7000-8000-000000000001";

describe("labs schemas", () => {
    it("parses the manage labs view with nullable times and missing labs", () => {
        const view = ManageLabsSchema.parse({
            InfrastructureAllowed: true, LaboratoriesAvailable: false, DeployLeadMinutes: 30, TeardownDelayMinutes: 60,
            DeployAt: null, TeardownAt: null, ChallengesOpened: false,
            Summary: {Total: 1, NotDeployed: 1, Creating: 0, Ready: 0, Failed: 0, Removed: 0},
            Items: [{TeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue", Moderators: false, Status: "not_deployed", Reason: null, UpdatedAt: null, Generation: 0, Labs: null}],
        });
        expect(view.Items[0]).toMatchObject({Reason: "", Labs: [], UpdatedAt: null});
    });

    it("rejects an unknown stand status", () => {
        expect(ManageLabsSchema.safeParse({
            InfrastructureAllowed: true, LaboratoriesAvailable: true, DeployLeadMinutes: 30, TeardownDelayMinutes: 60, DeployAt: null, TeardownAt: null, ChallengesOpened: false,
            Summary: {Total: 1, NotDeployed: 0, Creating: 0, Ready: 0, Failed: 0, Removed: 0},
            Items: [{TeamID: "01900000-0000-7000-8000-000000000022", Status: "Deploying", Labs: []}],
        }).success).toBe(false);
    });

    it("keeps static moderator challenges without a lab", () => {
        expect(ModeratorChallengeSchema.parse({ChallengeID: "01900000-0000-7000-8000-0000000000c2", Name: "A", Readiness: "available"}).Lab).toBeNull();
    });
});

describe("labs client", () => {
    it("recreates a failed stand and rejects invalid settings in mocks", async () => {
        vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "1");
        const failed = (await getManageLabs(eventID)).Items.find(item => item.Status === "failed")!;
        const recreated = await recreateStand(eventID, failed.TeamID);
        expect(recreated).toMatchObject({Status: "creating", Generation: failed.Generation + 1});
        await expect(putManageLabsSettings(eventID, {DeployLeadMinutes: 1, TeardownDelayMinutes: 0})).rejects.toBeInstanceOf(ManageApiError);
    });

    it("sends settings to the stand settings route", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: {
            InfrastructureAllowed: true, LaboratoriesAvailable: true, DeployLeadMinutes: 45, TeardownDelayMinutes: 0, DeployAt: null, TeardownAt: null, ChallengesOpened: true,
            Summary: {Total: 0, NotDeployed: 0, Creating: 0, Ready: 0, Failed: 0, Removed: 0}, Items: [],
        }}), {status: 200}));
        vi.stubGlobal("fetch", fetchMock);
        await putManageLabsSettings(eventID, {DeployLeadMinutes: 45, TeardownDelayMinutes: 0});
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`https://api.example.org/api/events/${eventID}/manage/labs/settings`);
        expect(init).toMatchObject({method: "PUT", body: JSON.stringify({DeployLeadMinutes: 45, TeardownDelayMinutes: 0})});
    });

    it("maps stand error codes", () => {
        expect(isInfrastructureNotAllowed(new ManageApiError(409, 2001))).toBe(true);
        expect(standErrorMessage(new ManageApiError(409, 2004), "x")).toContain("не розгорнуто");
        expect(standErrorMessage(new ManageApiError(503), "x")).toContain("недоступна");
        expect(standErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    });
});
