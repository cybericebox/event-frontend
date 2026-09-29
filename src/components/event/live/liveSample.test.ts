import {describe, expect, it} from "vitest";
import {liveSampleResults, liveSampleSpan} from "./liveSample";

describe("live sample results", () => {
    const now = Date.UTC(2026, 8, 29, 12);
    const sample = liveSampleResults(now);

    it("ranks ten teams by points, highest first", () => {
        expect(sample.Scoreboard).toHaveLength(10);
        expect(sample.Scoreboard.map(team => team.Rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const points = sample.Scoreboard.map(team => team.Points);
        expect([...points].sort((a, b) => b - a)).toEqual(points);
    });

    it("keeps every solve inside the three sample hours and sums to the points", () => {
        for (const solve of sample.Timeline) {
            const at = Date.parse(solve.SolvedAt);
            expect(at).toBeGreaterThanOrEqual(now - liveSampleSpan);
            expect(at).toBeLessThanOrEqual(now);
        }
        for (const team of sample.Scoreboard) {
            expect(sample.Timeline.filter(solve => solve.EventTeamID === team.TeamID).reduce((sum, solve) => sum + solve.Points, 0)).toBe(team.Points);
        }
    });

    it("is the same on every render", () => {
        expect(liveSampleResults(now)).toEqual(sample);
    });
});
