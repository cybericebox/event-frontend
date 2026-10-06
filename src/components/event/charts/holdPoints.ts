// A cumulative score only changes at a solve. Smoothing alone would draw growth
// between two sparse points, so before each change a point repeating the previous
// value is added just ahead of it: the line stays flat and rises only around the solve.
export const HOLD_MS = 1000;

export function holdPoints(points: readonly (readonly [number, number])[], gap = HOLD_MS): [number, number][] {
    const result: [number, number][] = [];
    for (const [time, value] of points) {
        const previous = result[result.length - 1];
        if (previous && previous[1] !== value && time - gap > previous[0]) result.push([time - gap, previous[1]]);
        result.push([time, value]);
    }
    return result;
}
