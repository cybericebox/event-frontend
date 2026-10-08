import {QueryClient} from "@tanstack/react-query";
import {describe, expect, it, vi} from "vitest";
import {ownBoardSchema, type ChallengeSubmission, type OwnBoard} from "@/api/participantChallenges";
import {runningLab, completedLab, manuallyStoppedLab, manualRunningLab} from "@/test/labLifecycle";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {applySubmission, applyModeratorSubmission, labLifecycleKey, newestLab, reconcileBoard, reconcileChallenges, rememberLab} from "./labLifecycleCache";

const otherLab = {...runningLab, ID: "00000000-0000-4000-8000-000000000101"};
// Fixtures use arbitrary question names only after the transport schema boundary.
const makeBoard = (): OwnBoard => ({...ownBoardSchema.parse({ServerNow: "2026-10-08T12:00:00Z"}), Challenges: [
    {...fixtureChallenge, EventChallengeID: "first", SolvedAt: null},
    {...fixtureChallenge, EventChallengeID: "second", SolvedAt: null},
    {...fixtureChallenge, EventChallengeID: "other", Lab: otherLab, SolvedAt: null},
    {...fixtureChallenge, EventChallengeID: "legacy", Lab: null, SolvedAt: null},
]});
const accepted = (Lab = runningLab, Practice = false): ChallengeSubmission => ({Correct: true, FirstSolve: true, Practice, Lab});

describe("authoritative shared Lab lifecycle", () => {
    it("retains solved closure across smaller, equal and conflicting larger revisions", () => {
        expect(newestLab(completedLab, runningLab)).toEqual(completedLab);
        expect(newestLab(completedLab, {...runningLab, Revision: completedLab.Revision})).toEqual(completedLab);
        expect(newestLab(completedLab, {...runningLab, Revision: "9007199254740995", CanRestart: true})).toEqual(completedLab);
        expect(newestLab(runningLab, completedLab)).toEqual(completedLab);
        expect(newestLab(completedLab, {...completedLab, Revision: "9007199254740995"}).Revision).toBe("9007199254740995");
    });

    it("orders arbitrary-length revisions and permits newer unresolved manual restart", () => {
        const manual = {...completedLab, CloseReason: "manual" as const};
        expect(newestLab(manual, {...runningLab, Revision: "100000000000000000000"}).LogicalClosed).toBe(false);
        expect(newestLab(manual, {...runningLab, Revision: manual.Revision})).toEqual(manual);
    });

    it("isolates event, board mode and participant Lab identity", () => {
        const client = new QueryClient();
        rememberLab(client, "participant", "event-a", completedLab);
        expect(rememberLab(client, "participant", "event-a", runningLab)).toEqual(completedLab);
        expect(rememberLab(client, "participant", "event-b", runningLab)).toEqual(runningLab);
        expect(rememberLab(client, "moderators", "event-a", runningLab)).toEqual(runningLab);
        expect(rememberLab(client, "participant", "event-a", otherLab)).toEqual(otherLab);
    });

    it("retains terminal closure while the shared Lab has no query observer", async () => {
        vi.useFakeTimers();
        // Match the browser's default instead of the server's infinite retention.
        const client = new QueryClient({defaultOptions: {queries: {gcTime: 5 * 60 * 1000}}});
        try {
            rememberLab(client, "participant", "event-a", completedLab);
            await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
            expect(rememberLab(client, "participant", "event-a", runningLab)).toEqual(completedLab);
        } finally {
            client.clear();
            vi.useRealTimers();
        }
    });

    it("clears lifecycle retention together with data instead of retaining per-Lab default registrations", () => {
        const client = new QueryClient();
        const key = labLifecycleKey("participant", "event-a", completedLab.ID);
        rememberLab(client, "participant", "event-a", completedLab);
        expect(client.getQueryCache().find({queryKey: key, exact: true})?.gcTime).toBe(Infinity);
        client.clear();
        expect(client.getQueryData(key)).toBeUndefined();
        expect(client.getQueryDefaults(key)).toEqual({});
        expect(rememberLab(client, "participant", "event-a", runningLab)).toEqual(runningLab);
    });

    it("retains the existing modal-owned query when remembering a lifecycle", () => {
        const client = new QueryClient({defaultOptions: {queries: {gcTime: 5 * 60 * 1000}}});
        const key = labLifecycleKey("participant", "event-a", runningLab.ID);
        const query = client.getQueryCache().build(client, {queryKey: key, gcTime: Infinity});
        rememberLab(client, "participant", "event-a", completedLab);
        expect(client.getQueryCache().find({queryKey: key, exact: true})).toBe(query);
        expect(query.gcTime).toBe(Infinity);
        expect(client.getQueryDefaults(key)).toEqual({});
    });

    it("solves only the answered question and propagates final closure to its shared Lab", () => {
        const client = new QueryClient();
        client.setQueryData(["event-own-challenges", "event-a"], makeBoard());
        applySubmission(client, "event-a", "first", accepted(), "first-at");
        const first = client.getQueryData<ReturnType<typeof makeBoard>>(["event-own-challenges", "event-a"])!;
        expect(first.Challenges.map(item => item.SolvedAt)).toEqual(["first-at", null, null, null]);
        expect(first.Challenges[0].Lab?.LogicalClosed).toBe(false);
        applySubmission(client, "event-a", "second", accepted(completedLab), "second-at");
        const final = client.getQueryData<typeof first>(["event-own-challenges", "event-a"])!;
        expect(final.Challenges.map(item => item.SolvedAt)).toEqual(["first-at", "second-at", null, null]);
        expect(final.Challenges.map(item => item.Lab?.LogicalClosed ?? null)).toEqual([true, true, false, null]);
        expect(reconcileBoard(client, "participant", "event-a", makeBoard()).Challenges.map(item => item.Lab?.LogicalClosed ?? null)).toEqual([true, true, false, null]);
    });

    it("records practice without rated solve or score and remembers Lab from rejected answers", () => {
        const client = new QueryClient();
        client.setQueryData(["event-own-challenges", "event-a"], makeBoard());
        applySubmission(client, "event-a", "first", accepted(runningLab, true), "practice-at");
        const practiced = client.getQueryData<ReturnType<typeof makeBoard>>(["event-own-challenges", "event-a"])!.Challenges[0];
        expect(practiced).toMatchObject({Practice: true, SolvedAt: null, AwardedPoints: null, AttemptsLeft: null});
        applySubmission(client, "event-a", "second", {...accepted(completedLab), Correct: false}, "ignored-at");
        expect(client.getQueryData(labLifecycleKey("participant", "event-a", runningLab.ID))).toEqual(completedLab);
        const final = client.getQueryData<ReturnType<typeof makeBoard>>(["event-own-challenges", "event-a"])!;
        expect(final.Challenges[1].SolvedAt).toBeNull();
        expect(final.Challenges[0].Lab).toEqual(completedLab);
    });

    it("reconciles every shared question when the newest lifecycle appears later in a board response", () => {
        const client = new QueryClient();
        const incoming = makeBoard();
        incoming.Challenges[1].Lab = completedLab;
        expect(reconcileBoard(client, "participant", "event-a", incoming).Challenges.map(item => item.Lab?.LogicalClosed ?? null)).toEqual([true, true, false, null]);
    });

    it("updates only the moderator question while sharing closure within the moderator array", () => {
        const client = new QueryClient();
        client.setQueryData(["event-moderators-board", "event-a"], makeBoard().Challenges);
        client.setQueryData(["event-own-challenges", "event-a"], makeBoard());
        applyModeratorSubmission(client, "event-a", "second", {Correct: true, FirstSolve: true, Lab: completedLab}, "moderator-at");
        const rows = client.getQueryData<ReturnType<typeof makeBoard>["Challenges"]>(["event-moderators-board", "event-a"])!;
        expect(rows.map(item => item.SolvedAt)).toEqual([null, "moderator-at", null, null]);
        expect(rows.map(item => item.Lab?.LogicalClosed ?? null)).toEqual([true, true, false, null]);
        expect(reconcileChallenges(client, "moderators", "event-a", makeBoard().Challenges)[0].Lab).toEqual(completedLab);
        expect(client.getQueryData<ReturnType<typeof makeBoard>>(["event-own-challenges", "event-a"])!.Challenges[0].Lab).toEqual(runningLab);
    });
});


it("manual closure/restart shares only lifecycle and preserves practice, scored history, points and unrelated Lab", () => {
    const client = new QueryClient();
    const original = makeBoard();
    original.Challenges[0] = {...original.Challenges[0], SolvedAt: "scored-at", AwardedPoints: 42};
    original.Challenges[1] = {...original.Challenges[1], Practice: true};
    rememberLab(client, "participant", "event-a", manuallyStoppedLab);
    const stopped = reconcileBoard(client, "participant", "event-a", original);
    expect(stopped.Challenges[0]).toEqual({...original.Challenges[0], Lab: manuallyStoppedLab});
    expect(stopped.Challenges[1]).toEqual({...original.Challenges[1], Lab: manuallyStoppedLab});
    expect(stopped.Challenges[2]).toEqual(original.Challenges[2]);
    const preparing = {...manualRunningLab, Revision: "9007199254740995", RuntimeState: "preparing" as const};
    rememberLab(client, "participant", "event-a", preparing);
    const restarted = reconcileBoard(client, "participant", "event-a", stopped);
    expect(restarted.Challenges[0]).toEqual({...original.Challenges[0], Lab: preparing});
    expect(restarted.Challenges[1]).toEqual({...original.Challenges[1], Lab: preparing});
    expect(restarted.Challenges[2]).toEqual(original.Challenges[2]);
});
