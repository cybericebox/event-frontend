import type {ManageResultsSnapshot} from "@/api/manageResults";

export type ChartPoint = [number, number];

// Monotone cubic (Fritsch–Carlson): a smooth curve through every point that
// never overshoots, so a cumulative score never appears to dip.
export function monotonePath(input: ChartPoint[]): string {
    // Equal x values would divide by zero: keep the last point of each x.
    const points = input.filter((point, index) => index === input.length - 1 || input[index + 1][0] !== point[0]);
    const fmt = (value: number) => (Math.round(value * 10) / 10).toString();
    if (!points.length) return "";
    if (points.length === 1) return `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
    const n = points.length, dx: number[] = [], slope: number[] = [], tangent: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        dx[i] = points[i + 1][0] - points[i][0];
        slope[i] = (points[i + 1][1] - points[i][1]) / dx[i];
    }
    tangent[0] = slope[0];
    tangent[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) {
        tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]);
    }
    let path = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
    for (let i = 0; i < n - 1; i++) {
        const h = dx[i] / 3;
        path += ` C${fmt(points[i][0] + h)} ${fmt(points[i][1] + tangent[i] * h)} ${fmt(points[i + 1][0] - h)} ${fmt(points[i + 1][1] - tangent[i + 1] * h)} ${fmt(points[i + 1][0])} ${fmt(points[i + 1][1])}`;
    }
    return path;
}

// The axis maximum: the value rounded up to a readable number.
export function niceMax(value: number): number {
    if (value <= 0) return 100;
    const power = 10 ** Math.floor(Math.log10(value));
    return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(factor => factor * power).find(candidate => candidate >= value) ?? value);
}

// A cumulative score over time: knots (ms) with the points reached there,
// straight between knots and flat after the last one. Several solves at one
// moment are several knots at one time: the last one holds.
export type ChartCurve = {times: number[]; values: number[]};
export type ChartLine = {teamID: string; name: string; curve: ChartCurve};

// The last moment the lines reach: the end of the axis, or the freeze moment
// (nothing after it is known, so the lines must not run on flat to «now»).
export function chartStop(start: number, end: number, cut: number | null): number {
    return cut !== null && cut < end ? Math.max(start, cut) : end;
}

// The top `lines` teams as score curves. The scores rise straight to their
// actual solve times: synthetic hold points would compress each rise into a
// near-vertical step. The curves do not depend on «now»: the lines are cut at
// the stop when drawn, so the running clock never moves them.
export function chartLines(results: ManageResultsSnapshot | undefined, lines: number, start: number): ChartLine[] {
    return (results?.Scoreboard ?? []).slice(0, lines).map(team => {
        const solves = (results?.Timeline ?? []).filter(item => item.EventTeamID === team.TeamID).sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
        let sum = 0;
        const knots = [[start, 0], ...solves.map(solve => [Math.max(start, Date.parse(solve.SolvedAt)), sum += solve.Points])];
        return {teamID: team.TeamID, name: team.TeamName, curve: {times: knots.map(knot => knot[0]), values: knots.map(knot => knot[1])}};
    });
}

// The axis maximum for these lines.
export function chartMax(lines: ChartLine[]): number {
    return niceMax(Math.max(0, ...lines.map(line => line.curve.values.at(-1) ?? 0)));
}

export function curveAt(curve: ChartCurve, time: number): number {
    const {times, values} = curve;
    // The first knot after `time`; the one before it is the last knot at or before `time`.
    const next = times.findIndex(knot => knot > time);
    if (next === -1) return values.at(-1) ?? 0;
    if (next === 0) return values[0];
    return values[next - 1] + (values[next] - values[next - 1]) * (time - times[next - 1]) / (times[next] - times[next - 1]);
}

// `from` moved the share `k` towards `to`. Both are straight between knots,
// so the blend is exact on the union of their knots; at k = 1 it is `to`.
export function blendCurves(from: ChartCurve, to: ChartCurve, k: number): ChartCurve {
    if (k >= 1) return to;
    const times = [...new Set([...from.times, ...to.times])].sort((a, b) => a - b);
    return {times, values: times.map(time => curveAt(from, time) + (curveAt(to, time) - curveAt(from, time)) * k)};
}

// A curve in pixel space up to `stop`: x runs from the event start to now (or
// the finish), y from 0 to `max`.
export function curvePath(curve: ChartCurve, box: {left: number; top: number; width: number; height: number}, start: number, end: number, stop: number, max: number): {path: string; endY: number} {
    const span = Math.max(1, end - start);
    const x = (time: number) => box.left + Math.min(1, Math.max(0, (time - start) / span)) * box.width;
    const y = (points: number) => box.top + box.height * (1 - points / Math.max(1e-9, max));
    const last = curveAt(curve, stop);
    const points = curve.times.flatMap((time, index): ChartPoint[] => time < stop ? [[x(time), y(curve.values[index])]] : []);
    points.push([x(stop), y(last)]);
    return {path: monotonePath(points), endY: y(last)};
}

// The x of the freeze moment, or null when the lines run to the end.
export function chartCutX(box: {left: number; width: number}, start: number, end: number, stop: number): number | null {
    return stop < end ? box.left + Math.min(1, Math.max(0, (stop - start) / Math.max(1, end - start))) * box.width : null;
}

// Line-end labels, pushed apart by at least `gap` and kept inside [top, bottom].
export function spreadLabels(ys: number[], gap: number, top: number, bottom: number): number[] {
    const order = ys.map((value, index) => ({value, index})).sort((a, b) => a.value - b.value);
    const placed: number[] = [];
    order.forEach((item, position) => {placed[position] = Math.max(item.value, position ? placed[position - 1] + gap : top);});
    for (let position = placed.length - 1; position >= 0; position--) {
        const limit = position === placed.length - 1 ? bottom : placed[position + 1] - gap;
        placed[position] = Math.max(top, Math.min(placed[position], limit));
    }
    const result: number[] = [];
    order.forEach((item, position) => {result[item.index] = placed[position];});
    return result;
}
