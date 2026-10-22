import {describe, expect, it} from "vitest";
import type {EventBoardChallenge, EventExerciseAttachment} from "@/api/manageChallenges";
import type {BoardSet} from "./challengeOrder";
import {taskStats, taskTopPoints} from "./taskStatsModel";

const hint = {ID: "h", Text: "", Level: "nudge", Cost: 0, Overridden: false} as EventBoardChallenge["Hints"][number];
const dynamic = {Mode: 1 as const, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50};

const challenge = (id: string, patch: Partial<EventBoardChallenge> = {}): EventBoardChallenge => ({
    ID: id, TaskID: id, GroupID: null, PrerequisiteIDs: [], Order: 0, Points: 100, EffectivePoints: 100, ScoringOverride: null,
    HintsEnabled: true, Published: true, MaxFlagAttempts: null, BoardOrder: null, Snapshot: {name: id, difficulty: "easy", placeholders: []}, Hints: [],
    ...patch,
});
const set = (id: string, challenges: EventBoardChallenge[], patch: Partial<EventExerciseAttachment> = {}): BoardSet => ({
    attachment: {ID: id, Infrastructure: false, StageID: null, Tags: [], ...patch} as EventExerciseAttachment, challenges,
});

const staticEvent = {Mode: 0 as const, MaxPoints: 0, ForceEventScoring: false};
const dynamicEvent = {Mode: 2 as const, MaxPoints: 800, ForceEventScoring: false};

describe("task top points", () => {
    it("is the effective static value when the task scores statically", () => {
        expect(taskTopPoints({EffectivePoints: 250, ScoringOverride: null}, staticEvent)).toBe(250);
        // A static own override keeps the task's own (effective) points even on a dynamic event.
        expect(taskTopPoints({EffectivePoints: 40, ScoringOverride: {...dynamic, Mode: 0}}, dynamicEvent)).toBe(40);
    });

    it("is the resolved dynamic profile's maximum: the override, unless the event forces its scoring", () => {
        expect(taskTopPoints({EffectivePoints: 100, ScoringOverride: null}, dynamicEvent)).toBe(800);
        expect(taskTopPoints({EffectivePoints: 100, ScoringOverride: dynamic}, staticEvent)).toBe(500);
        expect(taskTopPoints({EffectivePoints: 100, ScoringOverride: dynamic}, {...dynamicEvent, ForceEventScoring: true})).toBe(800);
        expect(taskTopPoints({EffectivePoints: 70, ScoringOverride: dynamic}, {...staticEvent, ForceEventScoring: true})).toBe(70);
    });
});

describe("task stats", () => {
    const sets = [
        set("web", [
            challenge("w1", {Snapshot: {name: "w1", difficulty: "hard", placeholders: []}, Hints: [hint, hint], GroupID: "g2"}),
            challenge("w2", {Published: false, EffectivePoints: 50, Snapshot: {name: "w2", placeholders: []}}),
        ], {Tags: ["web", "auth", "web "], StageID: "s1"}),
        set("net", [
            challenge("n1", {ScoringOverride: dynamic, Snapshot: {name: "n1", difficulty: "elementary", placeholders: []}, GroupID: "g1"}),
            challenge("n2", {Hints: [hint], Snapshot: {name: "n2", difficulty: "hard", placeholders: []}, GroupID: "gone"}),
        ], {Infrastructure: true, Tags: ["web"], StageID: "unknown-stage"}),
        set("bare", [challenge("b1", {Snapshot: {name: "b1", difficulty: "legendary", placeholders: []}})]),
    ];

    it("counts tasks, shown and hidden, points, infrastructure and hints", () => {
        const stats = taskStats(sets, staticEvent);
        expect(stats).toMatchObject({sets: 3, tasks: 5, published: 4, hidden: 1, withInfrastructure: 2, withHints: 2, hints: 3});
        // 100 + 50 + 500 (own dynamic) + 100 + 100; the hidden one is not on the board.
        expect(stats.maxPoints).toBe(850);
        expect(stats.publishedMaxPoints).toBe(800);
    });

    it("lists difficulties in the catalog order with the unknown ones last", () => {
        expect(taskStats(sets, staticEvent).byDifficulty).toEqual([
            {key: "elementary", count: 1}, {key: "hard", count: 2}, {key: null, count: 2},
        ]);
    });

    it("counts a task under every category of its set, most used first, uncategorised last", () => {
        expect(taskStats(sets, staticEvent).byCategory).toEqual([
            {key: "web", count: 4}, {key: "auth", count: 2}, {key: null, count: 1},
        ]);
    });

    it("follows the stage and group order; unknown and missing ids go to the «none» bucket", () => {
        const stats = taskStats(sets, staticEvent, {stageOrder: ["s0", "s1"], groupOrder: ["g1", "g2"]});
        expect(stats.byStage).toEqual([{key: "s1", count: 2}, {key: null, count: 3}]);
        expect(stats.byGroup).toEqual([{key: "g1", count: 1}, {key: "g2", count: 1}, {key: null, count: 3}]);
    });

    it("is empty without sets", () => {
        expect(taskStats([], staticEvent)).toMatchObject({sets: 0, tasks: 0, maxPoints: 0, byDifficulty: [], byCategory: []});
    });
});
