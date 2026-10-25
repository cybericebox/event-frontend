"use client";

import {useEffect, useLayoutEffect, useRef, useState, type RefObject} from "react";
import {chartMotionAt, chartMotionStep, liveEase, liveFollow, liveMotionMs, liveReducedMotion, rowOffset, rowSlides, type ChartMotion, type ChartTarget, type RowSlide} from "./liveMotion";

// The chart as drawn: it follows `target` frame by frame. The first render
// and «reduce motion» show the target as is. `target` must keep its identity
// until the data changes (useMemo), or every render restarts the motion.
export function useChartMotion(target: ChartTarget): ChartMotion {
    const [shown, setShown] = useState(() => chartMotionAt(target));
    const state = useRef(shown);
    const goal = useRef(target);
    const frame = useRef(0);
    useEffect(() => {
        if (goal.current === target) return;
        goal.current = target;
        if (liveReducedMotion()) {
            state.current = chartMotionAt(target);
            return;
        }
        if (frame.current) return;
        let last: number | null = null;
        const tick = (now: number) => {
            // The first frame counts as one 60 fps frame.
            const {motion, settled} = chartMotionStep(state.current, goal.current, liveFollow(last === null ? 16 : now - last));
            last = now;
            state.current = motion;
            setShown(motion);
            frame.current = settled ? 0 : requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
    }, [target]);
    useEffect(() => () => cancelAnimationFrame(frame.current), []);
    return liveReducedMotion() ? chartMotionAt(target) : shown;
}

// A number that counts up (or down) to `value` instead of jumping.
export function useCountTo(value: number): number {
    const [shown, setShown] = useState(value);
    // The value drawn last: a new value mid-count continues from there.
    const drawn = useRef(value);
    const goal = useRef(value);
    useEffect(() => {
        if (goal.current === value) return;
        goal.current = value;
        const from = drawn.current;
        if (liveReducedMotion()) {
            drawn.current = value;
            return;
        }
        let start: number | null = null;
        let frame = 0;
        const tick = (now: number) => {
            start ??= now;
            const progress = (now - start) / liveMotionMs;
            drawn.current = progress >= 1 ? value : from + (value - from) * liveEase(progress);
            setShown(Math.round(drawn.current));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value]);
    return liveReducedMotion() ? value : shown;
}

// Rows (`[data-row]` under `container`) slide to their new places and new
// rows fade in. A change of `layout` (another row height or width) moves the
// rows at once.
export function useRowMotion(container: RefObject<HTMLElement | null>, layout: string) {
    const slides = useRef(new Map<string, RowSlide>());
    const shape = useRef<string | null>(null);
    const frame = useRef(0);
    useLayoutEffect(() => {
        const root = container.current;
        if (!root) return;
        const rows = new Map<string, HTMLElement>();
        root.querySelectorAll<HTMLElement>("[data-row]").forEach(row => rows.set(row.dataset.row ?? "", row));
        const animate = shape.current === layout && !liveReducedMotion();
        shape.current = layout;
        const now = performance.now();
        slides.current = rowSlides(slides.current, new Map([...rows].map(([key, row]) => [key, row.offsetTop])), now, animate);
        const paint = (time: number) => {
            let moving = false;
            for (const [key, slide] of slides.current) {
                const row = rows.get(key);
                if (!row) continue;
                const progress = (time - slide.from) / liveMotionMs;
                const offset = rowOffset(slide, time);
                row.style.transform = progress < 1 && offset ? `translateY(${offset}px)` : "";
                row.style.opacity = progress < 1 && slide.fade ? String(liveEase(progress)) : "";
                if (progress < 1) moving = true;
            }
            frame.current = moving ? requestAnimationFrame(paint) : 0;
        };
        cancelAnimationFrame(frame.current);
        paint(now);
    });
    useEffect(() => () => cancelAnimationFrame(frame.current), []);
}
