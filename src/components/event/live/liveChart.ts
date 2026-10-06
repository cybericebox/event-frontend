import type {ManageResultsSnapshot} from "@/api/manageResults";
import {holdPoints} from "@/components/event/charts/holdPoints";

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

export type ChartSeries = {teamID: string; name: string; path: string; endY: number};

// Cumulative score lines in pixel space: x runs from the event start to now
// (or the finish), y from 0 to a round maximum.
export function chartSeries(results: ManageResultsSnapshot | undefined, lines: number, box: {left: number; top: number; width: number; height: number}, start: number, end: number): {series: ChartSeries[]; max: number} {
    const teams = (results?.Scoreboard ?? []).slice(0, lines);
    const max = niceMax(Math.max(0, ...teams.map(team => team.Points)));
    const span = Math.max(1, end - start);
    const x = (time: number) => box.left + Math.min(1, Math.max(0, (time - start) / span)) * box.width;
    const y = (points: number) => box.top + box.height * (1 - points / max);
    const series = teams.map(team => {
        const solves = (results?.Timeline ?? []).filter(item => item.EventTeamID === team.TeamID).sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
        // Cumulative score: flat between solves (a hold point ahead of each
        // change), rising smoothly only around a solve.
        let sum = 0;
        const clamp = (time: number) => Math.min(end, Math.max(start, time));
        const points = holdPoints([
            [start, 0],
            ...solves.map((solve): [number, number] => [clamp(Date.parse(solve.SolvedAt)), sum += solve.Points]),
            [end, sum],
        ]).map((point): ChartPoint => [x(point[0]), y(point[1])]);
        return {teamID: team.TeamID, name: team.TeamName, path: monotonePath(points), endY: y(sum)};
    });
    return {series, max};
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
