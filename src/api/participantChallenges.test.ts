import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {completedLab, exerciseID, runningLab} from "@/test/labLifecycle";

vi.mock("@/utils/origins", () => ({requireApiOrigin: () => "https://api.test"}));
const {getChallengeSolves, ParticipantChallengeError, SOLVES_PAGE_SIZE} = await import("./participantChallenges");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status});
const question = {
    ID: "11111111-1111-4111-8111-111111111111", EventChallengeID: "22222222-2222-4222-8222-222222222222",
    Snapshot: {name: "T", difficulty: "easy"}, Readiness: 2, SolvedAt: null,
    Points: 10, Order: 1, GroupID: null, GroupName: "", GroupOrder: 0,
};
const linkResponse = {URL: "https://web.labs.test/_auth?t=one-use", ExpiresAt: "2026-10-08T13:00:00Z", LabID: runningLab.ID, Revision: runningLab.Revision};

describe("getChallengeSolves", () => {
    it.each([undefined, false, true])("reads the task solutions freeze state (%s)", async Frozen => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 0, Items: [], Frozen}}));
        expect(await getChallengeSolves("e1", "c1")).toMatchObject({Frozen: Frozen ?? false});
    });
    it("asks the first page without a cursor and reads the wrapped page", async () => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 2, Items: [{TeamName: "Альфа", SolvedAt: "2026-01-01T10:00:00Z", Own: false, FirstBlood: true}], NextCursor: "11111111-1111-4111-8111-111111111111"}}));
        const page = await getChallengeSolves("e1", "c1");
        expect(fetchMock.mock.calls[0][0]).toBe(`https://api.test/api/events/e1/teams/challenges/c1/solves?pageSize=${SOLVES_PAGE_SIZE}`);
        expect(page.Items[0].FirstBlood).toBe(true);
        expect(page.NextCursor).toBe("11111111-1111-4111-8111-111111111111");
    });

    it("shows a placeholder instead of a blank when the name is hidden", async () => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 1, Items: [{TeamName: "", NameHidden: true, SolvedAt: "2026-01-01T10:00:00Z", Own: false}]}}));
        const page = await getChallengeSolves("e1", "c1");
        expect(page.Items[0].TeamName).not.toBe("");
    });

    it("sends the cursor and treats a missing NextCursor and null Items as the last, empty page", async () => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 0, Items: null}}));
        const page = await getChallengeSolves("e1", "c1", "22222222-2222-4222-8222-222222222222");
        expect(String(fetchMock.mock.calls[0][0])).toContain("cursor=22222222-2222-4222-8222-222222222222");
        expect(page).toEqual({Total: 0, Items: [], NextCursor: null, Frozen: false});
    });

    it("uses the moderators board URL for the organizer preview", async () => {
        fetchMock.mockResolvedValue(reply({Data: {Total: 0, Items: []}}));
        await getChallengeSolves("e1", "c1", null, true);
        expect(String(fetchMock.mock.calls[0][0])).toContain("/api/events/e1/manage/labs/moderators/challenges/c1/solves?");
    });

    it("carries the results-denied code of a 403", async () => {
        fetchMock.mockResolvedValue(reply({Status: {Code: 61213}}, 403));
        await expect(getChallengeSolves("e1", "c1")).rejects.toMatchObject({status: 403, code: 1213});
        expect(ParticipantChallengeError).toBeTruthy();
    });
});

describe("openLabLink", () => {
    it("retains exact link identity and decimal revision for a known Lab", async () => {
        const {openLabLink} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: linkResponse}));
        expect(await openLabLink("e1", "c1", "web", 80, false, runningLab)).toEqual({
            url: "https://web.labs.test/_auth?t=one-use", expiresAt: Date.parse("2026-10-08T13:00:00Z"),
            labID: runningLab.ID, revision: "9007199254740993",
        });
    });

    it.each([
        {LabID: undefined}, {Revision: undefined}, {LabID: null}, {Revision: null},
        {LabID: exerciseID}, {Revision: "9007199254740994"},
    ])("fences missing or mismatched known-Lab link fields %j", async fields => {
        const {openLabLink} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {...linkResponse, ...fields}}));
        await expect(openLabLink("e1", "c1", "web", 80, true, runningLab)).rejects.toThrow();
    });

    it.each([{Revision: 9007199254740992}, {Revision: "01"}, {LabID: "bad-id"}])("rejects malformed link fields even without a known Lab %j", async fields => {
        const {openLabLink} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {...linkResponse, ...fields}}));
        await expect(openLabLink("e1", "c1", "web", 80)).rejects.toThrow();
    });

    it("posts the device to the team route, or the manage route for the moderators team", async () => {
        const {openLabLink} = await import("./participantChallenges");
        fetchMock.mockImplementation(async () => reply({Data: {URL: "https://web-abc123.labs.test/_auth?t=x", ExpiresAt: "2026-09-30T13:00:00Z"}}));
        expect(await openLabLink("e1", "c1", "web", 80)).toEqual({url: "https://web-abc123.labs.test/_auth?t=x", expiresAt: Date.parse("2026-09-30T13:00:00Z"), labID: null, revision: null});
        await openLabLink("e1", "c1", "web", 80, true);
        expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/events\/e1\/teams\/challenges\/c1\/lab\/link$/);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "POST", credentials: "include", body: JSON.stringify({Device: "web", Port: 80})});
        expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/api/events/e1/manage/labs/moderators/challenges/c1/lab/link");
    });
});

describe("getOwnBoard", () => {
    it.each([null, "2026-10-20T14:00:00Z"])("discards obsolete task update metadata (%s)", async ContentUpdatedAt => {
        const {getOwnBoard} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {ServerNow: "2026-10-08T12:00:00Z", Challenges: [{...question, ContentUpdatedAt}]}}));
        expect((await getOwnBoard("e1")).Challenges[0]).not.toHaveProperty("ContentUpdatedAt");
    });

    it("keeps attachment identity on static questions and shares Lab identity across dependent questions", async () => {
        const {getOwnBoard} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {ServerNow: "2026-10-08T12:00:00Z", Challenges: [
            {...question, EventExerciseID: exerciseID, Lab: null},
            {...question, EventExerciseID: exerciseID, Lab: runningLab},
            {...question, EventChallengeID: "33333333-3333-4333-8333-333333333333", EventExerciseID: exerciseID, Lab: runningLab},
        ]}}));
        const {Challenges} = await getOwnBoard("e1");
        expect(Challenges.map(value => value.EventExerciseID)).toEqual([exerciseID, exerciseID, exerciseID]);
        expect(Challenges.map(value => value.Lab)).toEqual([null, runningLab, runningLab]);
    });

    it("normalizes legacy lifecycle absence without inferring identity from the question", async () => {
        const {getOwnBoard} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {ServerNow: "2026-10-08T12:00:00Z", Challenges: [question]}}));
        expect((await getOwnBoard("e1")).Challenges[0]).toMatchObject({EventExerciseID: null, Lab: null});
    });

    it.each([{EventExerciseID: "bad-id"}, {Lab: {...runningLab, Revision: 9007199254740992}}, {Lab: {...runningLab, RuntimeState: "stopping"}}])("rejects malformed present board lifecycle %j", async fields => {
        const {getOwnBoard} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {ServerNow: "2026-10-08T12:00:00Z", Challenges: [{...question, ...fields}]}}));
        await expect(getOwnBoard("e1")).rejects.toThrow();
    });

    it("reads the board with its stage context and fills the stage fields of a task", async () => {
        const {getOwnBoard} = await import("./participantChallenges");
        const task = {ID: "11111111-1111-4111-8111-111111111111", EventChallengeID: "22222222-2222-4222-8222-222222222222", Snapshot: {name: "T", difficulty: "easy"}, Readiness: 2, SolvedAt: null, Points: 10, Order: 1, GroupID: null, GroupName: "", GroupOrder: 0};
        fetchMock.mockResolvedValue(reply({Data: {
            Challenges: [task, {...task, EventChallengeID: "33333333-3333-4333-8333-333333333333", StageID: "44444444-4444-4444-8444-444444444444", Closed: true, Practice: true}],
            Stages: [{ID: "44444444-4444-4444-8444-444444444444", Name: "Один", OpensAt: "2026-10-01T10:00:00Z", ClosesAt: "2026-10-01T12:00:00Z", Returnable: true, State: "closed"}],
            ServerNow: "2026-10-01T12:30:00Z", CurrentStage: null, NextOpensAt: "2026-10-01T13:00:00Z", NextChangeAt: "2026-10-01T13:00:00Z",
        }}));
        const board = await getOwnBoard("e1");
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/events/e1/teams/challenges/mine");
        expect(board.Challenges[0]).toMatchObject({StageID: null, Closed: false, Practice: false});
        expect(board.Challenges[1]).toMatchObject({Closed: true, Practice: true});
        expect(board.Stages[0].State).toBe("closed");
        expect(board.NextOpensAt).toBe("2026-10-01T13:00:00Z");
        expect(board.CurrentStage).toBeNull();
    });

    it("treats an event without stages as an empty context", async () => {
        const {getOwnBoard} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {Challenges: null, Stages: null, ServerNow: "2026-10-01T12:30:00Z"}}));
        expect(await getOwnBoard("e1")).toMatchObject({Challenges: [], Stages: [], CurrentStage: null, NextOpensAt: null, NextChangeAt: null});
    });
});

describe("getOwnChallengeLab", () => {
    it("retains generic waiting status without scheduler diagnostics", async () => {
        const {getOwnChallengeLab} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {Phase: "Queued", Ready: false, Access: []}}));
        expect(await getOwnChallengeLab("e1", "c1")).toMatchObject({Phase: "Queued", Ready: false, Access: []});
    });
});

describe("submission lifecycle transport", () => {
    it.each([false, true])("preserves authoritative closure on correct submission with Practice=%s", async Practice => {
        const {submitChallenge} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {Correct: true, FirstSolve: true, Practice, Lab: completedLab}}));
        expect(await submitChallenge("e1", "c1", "answer", "key")).toEqual({Correct: true, FirstSolve: true, Practice, Lab: completedLab});
        expect(fetchMock.mock.calls[0]).toEqual(["https://api.test/api/events/e1/teams/challenges/c1/submit", expect.objectContaining({
            method: "POST", body: JSON.stringify({Answer: "answer"}), headers: expect.objectContaining({"Idempotency-Key": "key"}),
        })]);
    });

    it.each([undefined, null])("normalizes static/legacy submission Lab=%s", async Lab => {
        const {submitChallenge} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {Correct: false, Lab}}));
        expect(await submitChallenge("e1", "c1", "answer", "key")).toEqual({Correct: false, FirstSolve: false, Practice: false, Lab: null});
    });

    it("rejects malformed submission lifecycle", async () => {
        const {submitChallenge} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Data: {Correct: true, Lab: {...completedLab, Revision: 9007199254740992}}}));
        await expect(submitChallenge("e1", "c1", "answer", "key")).rejects.toThrow();
    });

    it("keeps the moderator route and parses its shared closure", async () => {
        const {submitModeratorFlag} = await import("./moderatorsBoard");
        fetchMock.mockResolvedValue(reply({Data: {Correct: true, FirstSolve: true, Practice: false, Lab: completedLab}}));
        expect(await submitModeratorFlag("e1", "c1", "answer")).toMatchObject({Correct: true, Lab: completedLab});
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/events/e1/manage/labs/moderators/challenges/c1/submit");
    });

    it("normalizes legacy moderator absence and rejects malformed present closure", async () => {
        const {submitModeratorFlag} = await import("./moderatorsBoard");
        fetchMock.mockResolvedValueOnce(reply({Data: {Correct: true}}))
            .mockResolvedValueOnce(reply({Data: {Correct: true, Lab: {...completedLab, RuntimeState: "StopFailed"}}}));
        expect(await submitModeratorFlag("e1", "c1", "answer")).toMatchObject({Correct: true, Lab: null});
        await expect(submitModeratorFlag("e1", "c1", "answer")).rejects.toThrow();
    });

    it("retains shared identity on the moderators board", async () => {
        const {getModeratorsBoard} = await import("./moderatorsBoard");
        fetchMock.mockResolvedValue(reply({Data: [{...question, EventExerciseID: exerciseID, Lab: runningLab}]}));
        expect((await getModeratorsBoard("e1"))[0]).toMatchObject({EventExerciseID: exerciseID, Lab: runningLab});
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/events/e1/manage/labs/moderators/board");
    });
});


describe("manual own Lab commands", () => {
    it.each(["stop", "restart"] as const)("posts %s to the session-scoped Lab route with exact operation identity", async action => {
        const {stopOwnLab, restartOwnLab} = await import("./participantChallenges");
        const saved = {...completedLab, CloseReason: "manual", CanRestart: true, SnapshotPolicy: "required"};
        fetchMock.mockResolvedValue(reply({Data: {Lab: saved}}));
        const key = "00000000-0000-4000-8000-000000000777";
        const result = await (action === "stop" ? stopOwnLab : restartOwnLab)("event /", runningLab.ID, runningLab.Revision, key);
        expect(fetchMock.mock.calls[0][0]).toBe(`https://api.test/api/events/event%20%2F/teams/labs/${runningLab.ID}/${action}`);
        expect(fetchMock.mock.calls[0][1]).toEqual({method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json", "Content-Type": "application/json"}, body: JSON.stringify({Revision: runningLab.Revision, IdempotencyKey: key})});
        expect(result).toMatchObject(saved);
    });
    it("uses the participant failure parser and rejects malformed authoritative replies", async () => {
        const {stopOwnLab} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Status: {Code: 61148}}, 409));
        await expect(stopOwnLab("e", runningLab.ID, runningLab.Revision, "key")).rejects.toMatchObject({status: 409, code: 1148});
        fetchMock.mockResolvedValue(reply({Data: {Lab: {...runningLab, Revision: 9007199254740992}}}));
        await expect(stopOwnLab("e", runningLab.ID, runningLab.Revision, "key")).rejects.toThrow();
    });
});

describe("idempotent retry of answers and Lab commands", () => {
    const overloaded = () => new Response(null, {status: 503, headers: {"Retry-After": "1"}});
    const keys = () => fetchMock.mock.calls.map(call => (call[1] as RequestInit & {headers: Record<string, string>}).headers["Idempotency-Key"]);
    beforeEach(() => {
        vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
        vi.spyOn(Math, "random").mockReturnValue(0);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("sends the answer again with the same Idempotency-Key until the overloaded server answers", async () => {
        const {submitChallenge} = await import("./participantChallenges");
        fetchMock.mockResolvedValueOnce(overloaded()).mockResolvedValueOnce(overloaded()).mockResolvedValueOnce(reply({Data: {Correct: true}}));
        const pending = submitChallenge("e1", "c1", "answer", "key-1");
        await vi.advanceTimersByTimeAsync(2000);
        await expect(pending).resolves.toMatchObject({Correct: true});
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(keys()).toEqual(["key-1", "key-1", "key-1"]);
    });

    it("waits a second and asks again while the same answer is still being processed", async () => {
        const {submitChallenge} = await import("./participantChallenges");
        fetchMock.mockResolvedValueOnce(reply({Status: {Code: 51926}}, 409)).mockResolvedValueOnce(reply({Data: {Correct: false}}));
        const pending = submitChallenge("e1", "c1", "answer", "key-2");
        await vi.advanceTimersByTimeAsync(999);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toMatchObject({Correct: false});
        expect(keys()).toEqual(["key-2", "key-2"]);
    });

    it("gives up after four tries and throws the overload error with its Retry-After", async () => {
        const {submitChallenge, ParticipantChallengeError} = await import("./participantChallenges");
        fetchMock.mockImplementation(() => Promise.resolve(overloaded()));
        const failed = expect(submitChallenge("e1", "c1", "answer", "key-3")).rejects.toSatisfy(error => error instanceof ParticipantChallengeError && error.status === 503 && error.retryAfter === 1);
        await vi.advanceTimersByTimeAsync(5000);
        await failed;
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("does not repeat a verdict or another conflict", async () => {
        const {submitChallenge} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(reply({Status: {Code: 51925}}, 409));
        await expect(submitChallenge("e1", "c1", "answer", "key-4")).rejects.toMatchObject({status: 409, code: 1925});
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("repeats a Lab command with the same key while it is in progress", async () => {
        const {stopOwnLab} = await import("./participantChallenges");
        const saved = {...completedLab, CloseReason: "manual", CanRestart: true, SnapshotPolicy: "required"};
        fetchMock.mockResolvedValueOnce(overloaded()).mockResolvedValueOnce(reply({Status: {Code: 52620}}, 409)).mockResolvedValueOnce(reply({Data: {Lab: saved}}));
        const pending = stopOwnLab("e", runningLab.ID, runningLab.Revision, "lab-key");
        await vi.advanceTimersByTimeAsync(2000);
        await expect(pending).resolves.toMatchObject(saved);
        expect(fetchMock.mock.calls.map(call => JSON.parse(String((call[1] as RequestInit).body)).IdempotencyKey)).toEqual(["lab-key", "lab-key", "lab-key"]);
    });

    it("never repeats the other participant actions", async () => {
        const {unlockChallengeHint} = await import("./participantChallenges");
        fetchMock.mockResolvedValue(overloaded());
        await expect(unlockChallengeHint("e1", "c1", "h1")).rejects.toMatchObject({status: 503, retryAfter: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
