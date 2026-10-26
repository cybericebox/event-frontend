import {blendCurves, curveAt, type ChartLine} from "./liveChart";

// Live motion: every change of the results eases in over about 0.6 s, so a
// screen watched from 15–20 m shows where things moved instead of a jump.
export const liveMotionMs = 600;

// Ease-out cubic over [0, 1].
export function liveEase(progress: number): number {
    return 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
}

// The share of the remaining way an eased value covers in `dt` ms. It does
// not depend on the frame rate, and a new target simply continues from where
// the value is; about 95 % of the way takes 0.3 s, the rest settles by 0.6 s.
export function liveFollow(dt: number): number {
    return 1 - Math.exp(-Math.max(0, dt) / 100);
}

export function liveReducedMotion(): boolean {
    return typeof window === "undefined" || typeof window.requestAnimationFrame !== "function"
        || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export type ChartShownLine = ChartLine & {color: string; opacity: number};
export type ChartMotion = {lines: ChartShownLine[]; max: number};
export type ChartTarget = {lines: (ChartLine & {color: string})[]; max: number};

export function chartMotionAt(target: ChartTarget): ChartMotion {
    return {lines: target.lines.map(line => ({...line, opacity: 1})), max: target.max};
}

// One frame towards the target. A team that enters the chart fades in on its
// own line; one that leaves keeps its colour and fades out. The lines come in
// the target order (the leader first), leaving lines last.
export function chartMotionStep(shown: ChartMotion, target: ChartTarget, k: number): {motion: ChartMotion; settled: boolean} {
    const before = new Map(shown.lines.map(line => [line.teamID, line]));
    const wanted = new Set(target.lines.map(line => line.teamID));
    const max = shown.max + (target.max - shown.max) * k;
    let settled = Math.abs(target.max - max) <= target.max * 2e-3;
    const lines: ChartShownLine[] = target.lines.map(line => {
        const from = before.get(line.teamID);
        if (!from) {
            settled = false;
            return {...line, opacity: k};
        }
        const curve = blendCurves(from.curve, line.curve, k);
        const gap = Math.max(0, ...curve.times.map((time, index) => Math.abs(curveAt(line.curve, time) - curve.values[index])));
        const opacity = from.opacity + (1 - from.opacity) * k;
        if (gap > target.max * 2e-3 || 1 - opacity > 0.01) settled = false;
        return {...line, curve, opacity};
    });
    for (const line of shown.lines) {
        if (wanted.has(line.teamID)) continue;
        const opacity = line.opacity * (1 - k);
        if (opacity > 0.01) {
            settled = false;
            lines.push({...line, opacity});
        }
    }
    return settled ? {motion: chartMotionAt(target), settled} : {motion: {lines, max}, settled};
}

// Row motion (FLIP): a row that moved starts where it was drawn and slides to
// its new place; a new row fades in. `offset` is where a row is drawn now
// relative to its place, for a slide that started at `from` ms.
export type RowSlide = {place: number; shift: number; from: number; fade: boolean};

export function rowOffset(slide: RowSlide, now: number): number {
    return slide.shift * (1 - liveEase((now - slide.from) / liveMotionMs));
}

export function rowSlides(previous: ReadonlyMap<string, RowSlide>, places: ReadonlyMap<string, number>, now: number, animate: boolean): Map<string, RowSlide> {
    const next = new Map<string, RowSlide>();
    for (const [key, place] of places) {
        const slide = previous.get(key);
        if (!animate) next.set(key, {place, shift: 0, from: now - liveMotionMs, fade: false});
        else if (!slide) next.set(key, {place, shift: 0, from: now, fade: true});
        else if (Math.abs(slide.place - place) < 0.5) next.set(key, slide);
        else next.set(key, {place, shift: slide.place + rowOffset(slide, now) - place, from: now, fade: false});
    }
    return next;
}
