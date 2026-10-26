import {describe, expect, it} from "vitest";
import {chartMotionAt, chartMotionStep, liveEase, liveFollow, liveMotionMs, rowOffset, rowSlides, type ChartTarget} from "./liveMotion";

const line = (teamID: string, points: number, color = "#fff") => ({teamID, name: teamID, color, curve: {times: [0, 100], values: [0, points]}});

function settle(shown: ReturnType<typeof chartMotionAt>, target: ChartTarget) {
    let frames = 0, state = {motion: shown, settled: false};
    while (!state.settled && frames < 500) {
        state = chartMotionStep(state.motion, target, liveFollow(16));
        frames++;
    }
    return {...state, frames};
}

describe("chart motion", () => {
    it("moves the lines and the axis towards the target and settles on it", () => {
        const before = chartMotionAt({lines: [line("a", 100)], max: 100, stop: 100});
        const target = {lines: [line("a", 300)], max: 300, stop: 100};
        const first = chartMotionStep(before, target, liveFollow(16));
        const end = first.motion.lines[0].curve.values.at(-1) ?? 0;
        expect(end).toBeGreaterThan(100);
        expect(end).toBeLessThan(300);
        expect(first.motion.max).toBeGreaterThan(100);
        expect(first.settled).toBe(false);
        const {motion, frames} = settle(first.motion, target);
        expect(motion).toEqual(chartMotionAt(target));
        // About 0.6 s at 60 fps.
        expect(frames * 16).toBeLessThan(liveMotionMs * 1.5);
    });

    it("fades a new team in and keeps the colour of a team that leaves", () => {
        const before = chartMotionAt({lines: [line("a", 100, "#f00"), line("b", 50, "#0f0")], max: 100, stop: 100});
        const target = {lines: [line("a", 100, "#f00"), line("c", 60, "#0f0")], max: 100, stop: 100};
        const {motion} = chartMotionStep(before, target, 0.5);
        expect(motion.lines.map(item => [item.teamID, item.color, item.opacity])).toEqual([["a", "#f00", 1], ["c", "#0f0", 0.5], ["b", "#0f0", 0.5]]);
        expect(settle(motion, target).motion.lines.map(item => item.teamID)).toEqual(["a", "c"]);
    });
});

describe("row motion", () => {
    it("slides a moved row from where it was drawn, also mid-slide", () => {
        const first = rowSlides(new Map(), new Map([["a", 0], ["b", 40]]), 0, false);
        expect(rowOffset(first.get("a")!, 0)).toBe(0);
        const swapped = rowSlides(first, new Map([["a", 40], ["b", 0]]), 1000, true);
        expect(rowOffset(swapped.get("a")!, 1000)).toBe(-40);
        expect(rowOffset(swapped.get("b")!, 1000)).toBe(40);
        expect(rowOffset(swapped.get("a")!, 1000 + liveMotionMs) + 0).toBe(0);
        // Halfway the row is drawn at 40 - 40 · (1 - ease(0.5)); a swap back starts there.
        const drawn = 40 + rowOffset(swapped.get("a")!, 1300);
        const back = rowSlides(swapped, new Map([["a", 0], ["b", 40]]), 1300, true);
        expect(rowOffset(back.get("a")!, 1300)).toBeCloseTo(drawn);
        expect(drawn).toBeCloseTo(40 - 40 * (1 - liveEase(0.5)));
    });

    it("fades new rows in and keeps a row that stayed", () => {
        const first = rowSlides(new Map(), new Map([["a", 0]]), 0, false);
        const next = rowSlides(first, new Map([["a", 0], ["b", 40]]), 500, true);
        expect(next.get("a")).toBe(first.get("a"));
        expect(next.get("b")).toMatchObject({fade: true, shift: 0, from: 500});
    });
});
