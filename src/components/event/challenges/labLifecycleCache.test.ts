import {QueryClient} from "@tanstack/react-query";
import {describe, expect, it, vi} from "vitest";
import {ownBoardSchema, type ChallengeSubmission, type OwnBoard, type OwnChallenge, type SnapshotPlaceholder} from "@/api/participantChallenges";
import {runningLab, completedLab, manuallyStoppedLab, manualRunningLab} from "@/test/labLifecycle";
import {labAccessScope} from "./labAccessScope";
import {hasCurrentRuntime, descriptionValues} from "./descriptionValues";
import type {LabRuntime} from "@/api/manageLabs";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {applySubmission, applyModeratorSubmission, labLifecycleKey, newestLab, reconcileBoard, reconcileChallenges, rememberLab, rememberRuntimeQuestionLab} from "./labLifecycleCache";

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


it.each(["participant", "moderators"] as const)("keeps a known terminal question attachment through a legacy %s board and runtime", mode => {
    const client = new QueryClient();
    const key = [mode === "participant" ? "event-own-challenges" : "event-moderators-board", "event-a"];
    const known = {...fixtureChallenge, Lab: completedLab};
    const rows = reconcileChallenges(client, mode, "event-a", [known]);
    client.setQueryData(key, mode === "participant" ? {...ownBoardSchema.parse({ServerNow: "now"}), Challenges: rows} : rows);
    const legacy: LabRuntime = {Lab: null, Phase: "Ready", Ready: true, Queue: null, VPNCIDR: "10.128.1.0/24", InternetCIDR: "", Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://legacy.test"}]};
    const delayed = reconcileChallenges(client, mode, "event-a", [{...known, Lab: null}]);
    client.setQueryData(key, mode === "participant" ? {...ownBoardSchema.parse({ServerNow: "now"}), Challenges: delayed} : delayed);
    const scope = labAccessScope(client, mode, "event-a", known.EventChallengeID, null, legacy);
    expect(scope.lifecycle).toEqual(completedLab);
    expect(hasCurrentRuntime(legacy, scope.lifecycle ?? null)).toBe(false);
    const placeholders: SnapshotPlaceholder[] = [
        {key: "host", kind: "external.link", device_name: "web"},
        {key: "ip", kind: "ip", ip_reference: "vpn", last_octet: 5, as_link: true, scheme: "http"},
        {key: "network", kind: "vpn.subnet"},
    ];
    expect(descriptionValues(placeholders, legacy, null)).toEqual({variables: {host: "https://legacy.test", ip: "http://10.128.1.5", network: "10.128.1.0/24"}, links: {host: "https://legacy.test", ip: "http://10.128.1.5"}});
    expect(descriptionValues(placeholders, legacy, scope.lifecycle ?? null)).toEqual({variables: {host: "—", ip: "—", network: "—"}, links: {}});
});
it("scopes remembered question attachments to event, mode, team, account and QueryClient session", () => {
    const client = new QueryClient();
    client.setQueryData(["event-current-user"], {ID: "account-a"});
    client.setQueryData(["event-own-team", "event-a"], {ID: "team-a"});
    reconcileChallenges(client, "participant", "event-a", [{...fixtureChallenge, Lab: completedLab}]);
    const legacy = {...fixtureChallenge, Lab: null};
    expect(reconcileChallenges(client, "participant", "event-a", [legacy])[0].Lab).toEqual(completedLab);
    expect(reconcileChallenges(client, "participant", "event-b", [legacy])[0].Lab).toBeNull();
    expect(reconcileChallenges(client, "moderators", "event-a", [legacy])[0].Lab).toBeNull();
    client.setQueryData(["event-own-team", "event-a"], {ID: "team-b"});
    expect(reconcileChallenges(client, "participant", "event-a", [legacy])[0].Lab).toBeNull();
    client.setQueryData(["event-own-team", "event-a"], {ID: "team-a"});
    client.setQueryData(["event-current-user"], {ID: "account-b"});
    expect(reconcileChallenges(client, "participant", "event-a", [legacy])[0].Lab).toBeNull();
    client.clear(); expect(reconcileChallenges(client, "participant", "event-a", [legacy])[0].Lab).toBeNull();
    expect(reconcileChallenges(new QueryClient(), "participant", "event-a", [legacy])[0].Lab).toBeNull();
});
it("an explicit replacement Lab or attachment cannot inherit the old terminal identity", () => {
    const client = new QueryClient();
    reconcileChallenges(client, "participant", "event-a", [{...fixtureChallenge, Lab: completedLab}]);
    const nextLab = {...runningLab, ID: "00000000-0000-4000-8000-000000000199", Revision: "1"};
    expect(reconcileChallenges(client, "participant", "event-a", [{...fixtureChallenge, Lab: nextLab}])[0].Lab).toEqual(nextLab);
    expect(reconcileChallenges(client, "participant", "event-a", [{...fixtureChallenge, Lab: null}])[0].Lab).toEqual(nextLab);
    const replacement: OwnChallenge = {...fixtureChallenge, EventExerciseID: "00000000-0000-4000-8000-000000000299", Lab: null};
    expect(reconcileChallenges(client, "participant", "event-a", [replacement])[0].Lab).toBeNull();
});


it("a delayed different runtime generation cannot replace a board attachment's terminal pin", () => {
    const client = new QueryClient();
    const rows = reconcileChallenges(client, "participant", "event-a", [{...fixtureChallenge, Lab: completedLab}]);
    client.setQueryData(["event-own-challenges", "event-a"], {...ownBoardSchema.parse({ServerNow: "now"}), Challenges: rows});
    rememberRuntimeQuestionLab(client, "participant", "event-a", fixtureChallenge.EventChallengeID, {...runningLab, ID: "00000000-0000-4000-8000-000000000199", Revision: "1"});
    expect(reconcileChallenges(client, "participant", "event-a", [{...fixtureChallenge, Lab: null}])[0].Lab).toEqual(completedLab);
});


it("binds an initially unknown identity/team once without losing its fence or carrying it to later identities", () => {
    const client = new QueryClient();
    const legacy = {...fixtureChallenge, Lab: null};
    reconcileChallenges(client, "moderators", "event-a", [{...fixtureChallenge, Lab: completedLab}]);
    client.setQueryData(["event-current-user"], {ID: "first-account"});
    client.setQueryData(["event-own-team", "event-a"], {ID: "first-team"});
    expect(reconcileChallenges(client, "moderators", "event-a", [legacy])[0].Lab).toEqual(completedLab);
    client.setQueryData(["event-current-user"], {ID: "next-account"});
    expect(reconcileChallenges(client, "moderators", "event-a", [legacy])[0].Lab).toBeNull();
    client.setQueryData(["event-current-user"], {ID: "first-account"});
    client.setQueryData(["event-own-team", "event-a"], {ID: "next-team"});
    expect(reconcileChallenges(client, "moderators", "event-a", [legacy])[0].Lab).toBeNull();
});
