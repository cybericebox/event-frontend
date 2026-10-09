import {afterEach, describe, expect, it, vi} from "vitest";
import {ManageApiError} from "./manage";
import {completedLab, runningLab} from "@/test/labLifecycle";
vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));
import {LabRuntimeSchema, ManageLabsSchema, ModeratorChallengeSchema, getModeratorChallengeLab, isInfrastructureNotAllowed, putManageLabsSettings, recreateStand, standErrorMessage} from "./manageLabs";

afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals();});

const eventID = "01900000-0000-7000-8000-000000000001";
const runtime = {Phase: "Ready", Ready: true, Queue: null, VPNCIDR: "10.128.1.0/24", InternetCIDR: "", Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://web.labs.test"}]};

describe("runtime lifecycle", () => {
    it("preserves access and authoritative Lab on participant and moderator routes", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({Data: {...runtime, Lab: runningLab}})));
        vi.stubGlobal("fetch", fetchMock);
        const {getOwnChallengeLab} = await import("./participantChallenges");
        expect(await getOwnChallengeLab(eventID, "c1")).toEqual({...runtime, Lab: runningLab});
        expect(await getModeratorChallengeLab(eventID, "c1")).toEqual({...runtime, Lab: runningLab});
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            `https://api.example.org/api/events/${eventID}/teams/challenges/c1/lab`,
            `https://api.example.org/api/events/${eventID}/manage/labs/moderators/challenges/c1/lab`,
        ]);
    });

    it("retains settled closure without replacing existing runtime fields", () => {
        expect(LabRuntimeSchema.parse({...runtime, Ready: false, Access: [], Lab: completedLab})).toEqual({...runtime, Ready: false, Access: [], Lab: completedLab});
    });

    it.each([undefined, null])("normalizes legacy Lab=%s while retaining access", Lab => {
        expect(LabRuntimeSchema.parse({...runtime, Lab})).toEqual({...runtime, Lab: null});
    });

    it.each([{Revision: 9007199254740992}, {RuntimeState: "stopping"}, {RuntimeState: "StopFailed"}, {ID: "bad-id"}])("rejects malformed present runtime lifecycle %j", fields => {
        expect(LabRuntimeSchema.safeParse({...runtime, Lab: {...runningLab, ...fields}}).success).toBe(false);
    });
});

describe("labs schemas", () => {
    it("parses the manage labs view with nullable times and missing labs", () => {
        const view = ManageLabsSchema.parse({
            InfrastructureAllowed: true, LaboratoriesAvailable: false, TeardownDelayMinutes: 60,
            DeployAt: null, TeardownAt: null, ChallengesOpened: false,
            Summary: {Total: 1, NotDeployed: 1, Creating: 0, Ready: 0, Failed: 0, Removed: 0},
            Items: [{TeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue", Moderators: false, Status: "not_deployed", Reason: null, UpdatedAt: null, Generation: 0, Labs: null}],
        });
        expect(view.Items[0]).toMatchObject({Reason: "", Labs: [], UpdatedAt: null});
    });

    it("parses a stand's queue and image warning, both absent by default", () => {
        const base = {InfrastructureAllowed: true, LaboratoriesAvailable: true, TeardownDelayMinutes: 60, DeployAt: null, TeardownAt: null, ChallengesOpened: false,
            Summary: {Total: 2, NotDeployed: 0, Creating: 2, Ready: 0, Failed: 0, Removed: 0}};
        const view = ManageLabsSchema.parse({...base, Items: [
            {TeamID: "01900000-0000-7000-8000-000000000022", Status: "creating", Labs: [], Queue: {QueuedLabs: 2, Position: 3, Length: 7, Reason: "TenantQuota"}, ImageWarning: true},
            {TeamID: "01900000-0000-7000-8000-000000000023", Status: "creating", Labs: [], Queue: null},
        ]});
        expect(view.Items[0]).toMatchObject({Queue: {QueuedLabs: 2, Position: 3, Length: 7, Reason: "TenantQuota"}, ImageWarning: true});
        expect(view.Items[1]).toMatchObject({Queue: null, ImageWarning: false});
    });

    it("rejects an unknown stand status", () => {
        expect(ManageLabsSchema.safeParse({
            InfrastructureAllowed: true, LaboratoriesAvailable: true, TeardownDelayMinutes: 60, DeployAt: null, TeardownAt: null, ChallengesOpened: false,
            Summary: {Total: 1, NotDeployed: 0, Creating: 0, Ready: 0, Failed: 0, Removed: 0},
            Items: [{TeamID: "01900000-0000-7000-8000-000000000022", Status: "Deploying", Labs: []}],
        }).success).toBe(false);
    });

    it("keeps static moderator challenges without a lab", () => {
        expect(ModeratorChallengeSchema.parse({ChallengeID: "01900000-0000-7000-8000-0000000000c2", Name: "A", Readiness: "available"}).Lab).toBeNull();
    });
});

describe("labs client", () => {
    it("recreates a stand and rejects invalid settings", async () => {
        const teamID = "01900000-0000-7000-8000-000000000022";
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({Data: {
                TeamID: teamID, TeamName: "Blue Team", Moderators: false, Status: "creating", Reason: "", UpdatedAt: null, Generation: 2, Labs: [],
            }}), {status: 200}))
            .mockResolvedValueOnce(new Response(JSON.stringify({Status: {Code: 0, Message: "invalid"}}), {status: 400}));
        vi.stubGlobal("fetch", fetchMock);
        expect(await recreateStand(eventID, teamID)).toMatchObject({Status: "creating", Generation: 2});
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`https://api.example.org/api/events/${eventID}/manage/labs/${teamID}/recreate`);
        expect(init).toMatchObject({method: "POST"});
        await expect(putManageLabsSettings(eventID, {TeardownDelayMinutes: -1})).rejects.toBeInstanceOf(ManageApiError);
    });

    it("sends settings to the stand settings route", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: {
            InfrastructureAllowed: true, LaboratoriesAvailable: true, TeardownDelayMinutes: 0, DeployAt: null, TeardownAt: null, ChallengesOpened: true,
            Summary: {Total: 0, NotDeployed: 0, Creating: 0, Ready: 0, Failed: 0, Removed: 0}, Items: [],
        }}), {status: 200}));
        vi.stubGlobal("fetch", fetchMock);
        await putManageLabsSettings(eventID, {TeardownDelayMinutes: 0});
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`https://api.example.org/api/events/${eventID}/manage/labs/settings`);
        expect(init).toMatchObject({method: "PUT", body: JSON.stringify({TeardownDelayMinutes: 0})});
    });

    it("maps stand error codes", () => {
        expect(isInfrastructureNotAllowed(new ManageApiError(409, 2001))).toBe(true);
        expect(standErrorMessage(new ManageApiError(409, 2004), "x")).toContain("не розгорнуто");
        expect(standErrorMessage(new ManageApiError(503), "x")).toContain("недоступна");
        expect(standErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    });
});
