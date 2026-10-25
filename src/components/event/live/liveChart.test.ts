import {describe, expect, it} from "vitest";
import {blendCurves, chartCutX, chartLines, chartMax, chartStop, curveAt, curvePath, monotonePath, niceMax, spreadLabels, type ChartPoint} from "./liveChart";

// Samples the cubic segments of a path produced by monotonePath.
function samplePath(path: string): ChartPoint[] {
    const numbers = path.replace(/[MC]/g, " ").trim().split(/\s+/).map(Number);
    const points: ChartPoint[] = [];
    let [x0, y0] = numbers;
    for (let i = 2; i < numbers.length; i += 6) {
        const [c1x, c1y, c2x, c2y, x1, y1] = numbers.slice(i, i + 6);
        for (let step = 0; step <= 10; step++) {
            const t = step / 10;
            const sample = (a: number, b: number, c: number, d: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
            points.push([sample(x0, c1x, c2x, x1), sample(y0, c1y, c2y, y1)]);
        }
        [x0, y0] = [x1, y1];
    }
    return points;
}

describe("monotonePath", () => {
    it("draws a smooth curve that never dips for a rising score", () => {
        const path = monotonePath([[0, 100], [10, 100], [20, 60], [30, 60], [40, 10], [50, 10]]);
        expect(path.startsWith("M0 100 C")).toBe(true);
        const ys = samplePath(path).map(point => point[1]);
        // y grows downwards: the line only goes up (y never increases).
        ys.slice(1).forEach((value, index) => expect(value).toBeLessThanOrEqual(ys[index] + 1e-6));
    });

    it("merges points on the same x", () => {
        expect(monotonePath([[0, 90], [0, 50], [10, 50]])).toBe("M0 50 C3.3 50 6.7 50 10 50");
        expect(monotonePath([[5, 5]])).toBe("M5 5");
        expect(monotonePath([])).toBe("");
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

// The pixel lines of the chart, as LiveChart draws them at rest.
function chartSeries(results: Parameters<typeof chartLines>[0], lines: number, box: {left: number; top: number; width: number; height: number}, start: number, end: number, cut: number | null = null) {
    const stop = chartStop(start, end, cut);
    const curves = chartLines(results, lines, start, stop);
    const max = chartMax(curves);
    const series = curves.map(line => ({...curvePath(line.curve, box, start, end, max), endX: box.left + Math.min(1, (stop - start) / (end - start)) * box.width}));
    return {series, max, cutX: chartCutX(box, start, end, stop)};
}

describe("chart lines", () => {
    it("interpolates smoothly between solve times without narrow steps", () => {
        const team = "01900000-0000-7000-8000-000000000041";
        const results = {
            Revision: 1, TotalTeams: 1, Freeze: {BannerText: "", BannerLevel: "warning" as const, Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
            Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
            Scoreboard: [{Rank: 1, TeamID: team, TeamName: "A", Points: 300, Solved: 2}],
            Timeline: [
                {EventTeamID: team, EventChallengeID: team, ChallengeName: "x", Points: 100, SolvedAt: new Date(50000).toISOString()},
                {EventTeamID: team, EventChallengeID: team, ChallengeName: "y", Points: 200, SolvedAt: new Date(75000).toISOString()},
            ],
        };
        const {series, max} = chartSeries(results, 5, {left: 0, top: 0, width: 100, height: 300}, 0, 100000);
        expect(max).toBe(300);
        expect(series[0].path.startsWith("M0 300 ")).toBe(true);
        expect(series[0].path).toContain(" 50 200 ");
        expect(series[0].path).toContain(" 75 0 ");
        // Halfway to the first solve, the curve has visibly risen from zero.
        const middle = samplePath(series[0].path).filter(([x]) => x >= 20 && x <= 30);
        expect(middle.length).toBeGreaterThan(0);
        middle.forEach(([, y]) => {
            expect(y).toBeGreaterThan(200);
            expect(y).toBeLessThan(300);
        });
        const ys = samplePath(series[0].path).map(point => point[1]);
        ys.slice(1).forEach((value, index) => expect(value).toBeLessThanOrEqual(ys[index] + 1e-6));
        ys.forEach(value => expect(value).toBeGreaterThanOrEqual(0));
        expect(series[0].endY).toBe(0);
    });

    it("stops the lines at the freeze moment instead of running on to now", () => {
        const team = "01900000-0000-7000-8000-000000000042";
        const results = {
            Revision: 1, TotalTeams: 1, Freeze: {BannerText: "", BannerLevel: "warning" as const, Enabled: true, FrozenAt: new Date(60000).toISOString(), FinishAt: null, OpenedAt: null, Active: true, Applied: true},
            Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
            Scoreboard: [{Rank: 1, TeamID: team, TeamName: "A", Points: 100, Solved: 1}],
            Timeline: [{EventTeamID: team, EventChallengeID: team, ChallengeName: "x", Points: 100, SolvedAt: new Date(40000).toISOString()}],
        };
        const box = {left: 0, top: 0, width: 100, height: 300};
        const frozen = chartSeries(results, 5, box, 0, 100000, 60000);
        expect(frozen.cutX).toBe(60);
        expect(frozen.series[0].endX).toBe(60);
        expect(Math.max(...samplePath(frozen.series[0].path).map(([x]) => x))).toBeLessThanOrEqual(60 + 1e-6);
        // A freeze moment after the end of the axis changes nothing.
        const later = chartSeries(results, 5, box, 0, 100000, 200000);
        expect(later.cutX).toBeNull();
        expect(later.series[0].endX).toBe(100);
    });
});

describe("blendCurves", () => {
    const from = {times: [0, 50, 100], values: [0, 100, 100]};
    const to = {times: [0, 80, 100], values: [0, 300, 300]};

    it("blends on the union of the knots and is the target at k = 1", () => {
        const half = blendCurves(from, to, 0.5, 100);
        expect(half.times).toEqual([0, 50, 80, 100]);
        expect(half.values).toEqual([0, (100 + 187.5) / 2, (100 + 300) / 2, 200]);
        expect(blendCurves(from, to, 1, 100)).toBe(to);
    });

    it("drops knots after the stop (a freeze moves it back)", () => {
        const blended = blendCurves(from, to, 0.5, 60);
        expect(Math.max(...blended.times)).toBe(60);
        expect(curveAt(blended, 60)).toBeCloseTo((100 + 225) / 2);
    });
});
