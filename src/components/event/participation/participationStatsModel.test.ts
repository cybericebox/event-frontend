import {describe, expect, it} from "vitest";
import type {ParticipationSolve} from "@/api/participationStats";
import {categoryBreakdown, chartWindow, cumulativePoints, ownSolves, relativeTime, successRate, wrongAttempts} from "./participationStatsModel";

const solve = (category: string, points: number, by: string | null, at = "2026-01-01T10:00:00Z"): ParticipationSolve => ({
    EventChallengeID: `${category}-${points}`, ChallengeName: "T", Category: category, Points: points, SolvedAt: at, SolvedByUserID: by, SolvedByName: "", FirstBlood: false,
});

describe("participation stats model", () => {
    it("accumulates points in time order, penalties included", () => {
        const series = cumulativePoints([{at: "2026-01-01T12:00:00Z", points: -20}, {at: "2026-01-01T10:00:00Z", points: 100}, {at: "2026-01-01T11:00:00Z", points: 50}]);
        expect(series.map(point => point[1])).toEqual([100, 150, 130]);
    });

    it("splits solves by category, most solved first", () => {
        const shares = categoryBreakdown([solve("Web", 100, "a"), solve("Crypto", 300, "a"), solve("Web", 50, "b")]);
        expect(shares).toEqual([{category: "Web", solves: 2, points: 150}, {category: "Crypto", solves: 1, points: 300}]);
    });

    it("keeps only the caller's own solves", () => {
        expect(ownSolves([solve("Web", 1, "a"), solve("Web", 2, "b"), solve("Web", 3, null)], "a")).toHaveLength(1);
    });

    it("has no success rate without attempts and never a negative wrong count", () => {
        expect(successRate(0, 0)).toBeNull();
        expect(successRate(1, 4)).toBe(25);
        expect(wrongAttempts(5, 3)).toBe(0);
    });

    it("reads relative time in words", () => {
        const now = Date.parse("2026-01-01T12:00:00Z");
        expect(relativeTime("2026-01-01T11:59:50Z", now)).toBe("щойно");
        expect(relativeTime("2026-01-01T11:00:00Z", now)).toContain("годин");
    });

    it("ends the chart at the finish once the event is over", () => {
        const window = chartWindow("2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z", Date.parse("2026-02-01T00:00:00Z"), null);
        expect(window.to).toBe(Date.parse("2026-01-01T12:00:00Z"));
    });
});
