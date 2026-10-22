import {describe, expect, it} from "vitest";
import {groupTaskDifficulty, groupTaskPoints} from "./groupTaskMeta";

const staticEvent = {Mode: 0 as const, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0, ForceEventScoring: false, StaticPoints: null, UpdatedAt: ""};
const dynamicEvent = {...staticEvent, Mode: 1 as const, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50};
const task = (patch: Record<string, unknown> = {}) => ({Points: 150, EffectivePoints: 150, ScoringOverride: null, Snapshot: {name: "Рахунок директора", difficulty: "medium", placeholders: []}, ...patch});

describe("group order: difficulty and points of a task", () => {
    it("names the difficulty like the rest of the panel, nothing for an unknown one", () => {
        expect(groupTaskDifficulty(task())).toBe("Середня");
        expect(groupTaskDifficulty(task({Snapshot: {name: "x", placeholders: []}}))).toBe("");
        expect(groupTaskDifficulty(task({Snapshot: {name: "x", difficulty: "legendary", placeholders: []}}))).toBe("");
    });

    it("shows the points teams score, with the plural of «бал»", () => {
        expect(groupTaskPoints(task(), staticEvent)).toBe("150 балів");
        expect(groupTaskPoints(task({EffectivePoints: 1}), staticEvent)).toBe("1 бал");
        expect(groupTaskPoints(task({EffectivePoints: 22}), staticEvent)).toBe("22 бали");
    });

    it("shows the dynamic range of the task's own scoring, or of the event when the task follows it", () => {
        expect(groupTaskPoints(task({ScoringOverride: {Mode: 2, MinPoints: 50, MaxPoints: 300, FloorAtPercent: 0}}), staticEvent)).toBe("динамічні 300→50");
        expect(groupTaskPoints(task(), dynamicEvent)).toBe("динамічні 500→100");
        expect(groupTaskPoints(task({ScoringOverride: {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0}}), dynamicEvent)).toBe("150 балів");
        expect(groupTaskPoints(task({ScoringOverride: {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0}}), {...dynamicEvent, ForceEventScoring: true})).toBe("динамічні 500→100");
    });

    it("waits for the event scoring before guessing", () => {
        expect(groupTaskPoints(task(), undefined)).toBe("");
    });
});
