import {describe, expect, it} from "vitest";
import {liveSampleResults, liveSampleSpan} from "./liveSample";

describe("live sample results", () => {
    const now = Date.UTC(2026, 8, 29, 12);
    const sample = liveSampleResults(now);

    it("ranks forty teams by points, highest first, with at least 30 solves", () => {
        expect(sample.Scoreboard).toHaveLength(40);
        expect(sample.Scoreboard.map(team => team.Rank)).toEqual(Array.from({length: 40}, (_, index) => index + 1));
        expect(sample.Timeline.length).toBeGreaterThanOrEqual(30);
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
