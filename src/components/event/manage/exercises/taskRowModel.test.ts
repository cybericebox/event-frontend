import {describe, expect, it} from "vitest";
import type {ManageLabs} from "@/api/manageLabs";
import type {EventBoardChallenge} from "@/api/manageChallenges";
import {standReadiness, taskBadges} from "./taskRowModel";

const labs = (entries: Array<{ChallengeID: string; Status: "pending" | "ready" | "failed" | "removed"}>) =>
    ({Items: [{Labs: entries.map(entry => ({...entry, ChallengeName: "", Reason: ""}))}]}) as unknown as ManageLabs;
const hint = {ID: "h", Text: "", Level: "nudge", Cost: 0, Overridden: false} as EventBoardChallenge["Hints"][number];

describe("task row", () => {
    it("reads stand readiness from every team's lab of the task", () => {
        expect(standReadiness("c1", undefined)).toBeNull();
        expect(standReadiness("c1", labs([{ChallengeID: "c2", Status: "ready"}]))).toBeNull();
        expect(standReadiness("c1", labs([{ChallengeID: "c1", Status: "ready"}, {ChallengeID: "c1", Status: "ready"}]))).toBe("ready");
        expect(standReadiness("c1", labs([{ChallengeID: "c1", Status: "ready"}, {ChallengeID: "c1", Status: "pending"}]))).toBe("notReady");
    });

    it("lists status badges", () => {
        expect(taskBadges({Published: false, ScoringOverride: null, HintsEnabled: true, Hints: []}, null).map(badge => badge.key)).toEqual(["board"]);
        const badges = taskBadges({Published: true, ScoringOverride: {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0}, HintsEnabled: true, Hints: [hint]}, "notReady");
        expect(badges.map(badge => [badge.key, badge.tone])).toEqual([["board", "ok"], ["scoring", undefined], ["hints", undefined], ["stand", "warn"]]);
    });
});
