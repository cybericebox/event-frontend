import {describe, expect, it} from "vitest";
import {chartSeries, monotonePath, niceMax, spreadLabels} from "./liveChart";

// Samples the cubic segments of a path produced by monotonePath.
function sampleY(path: string): number[] {
    const numbers = path.replace(/[MC]/g, " ").trim().split(/\s+/).map(Number);
    const ys: number[] = [];
    let [x0, y0] = numbers;
    for (let i = 2; i < numbers.length; i += 6) {
        const [, c1y, , c2y, , y1] = numbers.slice(i, i + 6);
        for (let t = 0; t <= 1; t += 0.1) ys.push((1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * c1y + 3 * (1 - t) * t ** 2 * c2y + t ** 3 * y1);
        [x0, y0] = [numbers[i + 4], y1];
    }
    void x0;
    return ys;
}

describe("monotonePath", () => {
    it("draws a smooth curve that never dips for a rising score", () => {
        const path = monotonePath([[0, 100], [10, 100], [20, 60], [30, 60], [40, 10], [50, 10]]);
        expect(path.startsWith("M0 100 C")).toBe(true);
        const ys = sampleY(path);
        // y grows downwards: the line only goes up (y never increases).
        ys.slice(1).forEach((value, index) => expect(value).toBeLessThanOrEqual(ys[index] + 1e-6));
    });

    it("merges points on the same x", () => {
        expect(monotonePath([[0, 90], [0, 50], [10, 50]])).toBe("M0 50 C3.3 50 6.7 50 10 50");
        expect(monotonePath([[5, 5]])).toBe("M5 5");
    });
});

describe("niceMax", () => {
    it("rounds the axis up to a readable step", () => {
        expect(niceMax(4820)).toBe(5000);
        expect(niceMax(730)).toBe(800);
        expect(niceMax(0)).toBe(100);
        expect(niceMax(100)).toBe(100);
    });
});

describe("spreadLabels", () => {
    it("keeps labels apart and inside the plot", () => {
        expect(spreadLabels([10, 12, 100], 20, 0, 120)).toEqual([10, 30, 100]);
        expect(spreadLabels([118, 119], 20, 0, 120)).toEqual([100, 120]);
    });
});

describe("chartSeries", () => {
    it("holds the score flat and rises only around a solve", () => {
        const team = "01900000-0000-7000-8000-000000000041";
        const results = {
            Revision: 1, GeneratedAt: "", TotalTeams: 1, Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
            Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
            Scoreboard: [{Rank: 1, TeamID: team, TeamName: "A", Points: 300, Solved: 2, LastSolveAt: null}],
            Timeline: [
                {EventTeamID: team, EventChallengeID: team, ChallengeName: "x", Points: 100, SolvedAt: new Date(50000).toISOString()},
                {EventTeamID: team, EventChallengeID: team, ChallengeName: "y", Points: 200, SolvedAt: new Date(75000).toISOString()},
            ],
        };
        const {series, max} = chartSeries(results, 5, {left: 0, top: 0, width: 100, height: 300}, 0, 100000);
        expect(max).toBe(300);
        // The hold point sits 1 s ahead of the first solve at 50 s: flat at 0 until then.
        expect(series[0].path.startsWith("M0 300 ")).toBe(true);
        expect(series[0].path).toContain(" 49 300 ");
        expect(series[0].path).toContain(" 50 200 ");
        expect(series[0].endY).toBe(0);
    });
});
