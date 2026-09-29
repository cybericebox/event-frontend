import {describe, expect, it} from "vitest";
import type {ManageLabs} from "@/api/manageLabs";
import type {EventBoardChallenge} from "@/api/manageChallenges";
import {hintIndicator, standReadiness, taskBadges} from "./taskRowModel";

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
        expect(taskBadges({Published: false, ScoringOverride: null}, null).map(badge => [badge.key, badge.label])).toEqual([["board", "Приховано"]]);
        const badges = taskBadges({Published: true, ScoringOverride: {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0}}, "notReady");
        expect(badges.map(badge => [badge.label, badge.tone])).toEqual([["Показано", "ok"], ["Власне оцінювання", undefined], ["Стенд не готовий", "warn"]]);
    });

    it("shows the hint count and whether participants see the hints", () => {
        expect(hintIndicator({HintsEnabled: true, Hints: []}, false)).toBeNull();
        expect(hintIndicator({HintsEnabled: true, Hints: [hint, hint]}, false)).toMatchObject({count: 2, shown: true});
        expect(hintIndicator({HintsEnabled: false, Hints: [hint]}, false)).toMatchObject({count: 1, shown: false, tooltip: expect.stringContaining("у завданні вимкнено")});
        // The event kill switch hides hints even when the task shows them.
        expect(hintIndicator({HintsEnabled: true, Hints: [hint]}, true)).toMatchObject({shown: false, tooltip: expect.stringContaining("для всіх завдань")});
    });
});
