import {describe, expect, it} from "vitest";
import type {ManageLabs} from "@/api/manageLabs";
import type {EventBoardChallenge} from "@/api/manageChallenges";
import {hintIndicator, setOpenByDefault, setStatus, setSummary, standReadiness, taskBadges} from "./taskRowModel";

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

    it("lists status badges (visibility is per set)", () => {
        expect(taskBadges({ScoringOverride: null, Points: 100, EffectivePoints: 100}, null)).toEqual([]);
        const badges = taskBadges({ScoringOverride: {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0}, Points: 100, EffectivePoints: 100}, "notReady");
        expect(badges.map(badge => [badge.label, badge.tone])).toEqual([["Власне оцінювання", undefined], ["Стенд не готовий", "warn"]]);
    });

    it("shows the value teams get when the event sets it", () => {
        expect(taskBadges({ScoringOverride: null, Points: 250, EffectivePoints: 100}, null).map(badge => badge.label)).toEqual(["100 балів"]);
    });

    it("derives a set's status: broken wins, else shown when its tasks are shown", () => {
        expect(setStatus([{Published: true}], true)).toBe("broken");
        expect(setStatus([{Published: true}, {Published: true}], false)).toBe("shown");
        expect(setStatus([{Published: false}], false)).toBe("hidden");
        expect(setStatus([], false)).toBe("hidden");
    });

    it("shows the hint count and whether participants see the hints", () => {
        expect(hintIndicator({HintsEnabled: true, Hints: []}, false)).toBeNull();
        expect(hintIndicator({HintsEnabled: true, Hints: [hint, hint]}, false)).toMatchObject({count: 2, shown: true});
        expect(hintIndicator({HintsEnabled: false, Hints: [hint]}, false)).toMatchObject({count: 1, shown: false, tooltip: expect.stringContaining("у підзавданні вимкнено")});
        // The event kill switch hides hints even when the task shows them.
        expect(hintIndicator({HintsEnabled: true, Hints: [hint]}, true)).toMatchObject({shown: false, tooltip: expect.stringContaining("для всіх завдань")});
    });

    it("summarizes a set for its collapsed header", () => {
        const own = {Mode: 0 as const, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0};
        const tasks = [
            {HintsEnabled: true, Hints: [hint], ScoringOverride: null},
            {HintsEnabled: false, Hints: [hint, hint], ScoringOverride: own},
            {HintsEnabled: true, Hints: [], ScoringOverride: null},
        ];
        const summary = setSummary(tasks, false, [null, "ready", "notReady"]);
        expect(summary).toMatchObject({hints: {count: 2, shown: true}, ownScoring: true, stand: "notReady"});
        expect(summary.hints?.tooltip).toContain("в 1");
        expect(setSummary(tasks, true, [null, null, null])).toMatchObject({hints: {count: 2, shown: false}, stand: null});
        expect(setSummary([tasks[1]], false, ["ready"])).toMatchObject({hints: {count: 1, shown: false}, ownScoring: true, stand: "ready"});
        expect(setSummary([tasks[2]], false, [])).toMatchObject({hints: null, ownScoring: false});
    });

    it("collapses sets by default when there are more than three", () => {
        expect(setOpenByDefault(3)).toBe(true);
        expect(setOpenByDefault(4)).toBe(false);
    });
});
