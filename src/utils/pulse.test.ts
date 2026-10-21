// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {Pulse} from "@/api/pulse";
import {createPulseLoop, PULSE_INTERVAL_MS} from "./pulse";

let visibility: "visible" | "hidden" = "visible";
const setVisibility = (value: "visible" | "hidden") => {
    visibility = value;
    document.dispatchEvent(new Event("visibilitychange"));
};
const pulse = (Banners = "v1"): Pulse => ({Banners, Inbox: null});

beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {configurable: true, get: () => visibility});
});
afterEach(() => vi.useRealTimers());

describe("pulse loop", () => {
    it("pulses at once, then every 30 s spread by ±20 %", async () => {
        const fetcher = vi.fn(async () => pulse());
        const low = createPulseLoop(fetcher, () => 0);
        const stop = low.subscribe(() => {});
        await vi.advanceTimersByTimeAsync(0);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * 0.8 - 1);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetcher).toHaveBeenCalledTimes(2);
        stop();

        const highFetcher = vi.fn(async () => pulse());
        const high = createPulseLoop(highFetcher, () => 1);
        const stopHigh = high.subscribe(() => {});
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * 1.2 - 1);
        expect(highFetcher).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(highFetcher).toHaveBeenCalledTimes(2);
        stopHigh();
    });

    it("shares one loop between subscribers and replays the last pulse to a late one", async () => {
        const fetcher = vi.fn(async () => pulse("v7"));
        const loop = createPulseLoop(fetcher);
        const first = vi.fn();
        const second = vi.fn();
        const stopFirst = loop.subscribe(first);
        await vi.advanceTimersByTimeAsync(0);
        const stopSecond = loop.subscribe(second);
        await vi.advanceTimersByTimeAsync(0);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledWith(pulse("v7"));
        stopFirst();
        stopSecond();
        await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * 3);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("pauses while hidden and pulses once when visible again", async () => {
        const fetcher = vi.fn(async () => pulse());
        const stop = createPulseLoop(fetcher).subscribe(() => {});
        await vi.advanceTimersByTimeAsync(0);
        setVisibility("hidden");
        await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * 4);
        expect(fetcher).toHaveBeenCalledTimes(1);
        setVisibility("visible");
        await vi.advanceTimersByTimeAsync(0);
        expect(fetcher).toHaveBeenCalledTimes(2);
        stop();
    });

    it("wakes on focus and online at most once per 5 s", async () => {
        const fetcher = vi.fn(async () => pulse());
        const stop = createPulseLoop(fetcher).subscribe(() => {});
        await vi.advanceTimersByTimeAsync(0);
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("online"));
        await vi.advanceTimersByTimeAsync(0);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(5_000);
        window.dispatchEvent(new Event("focus"));
        await vi.advanceTimersByTimeAsync(0);
        expect(fetcher).toHaveBeenCalledTimes(2);
        window.dispatchEvent(new Event("online"));
        await vi.advanceTimersByTimeAsync(0);
        expect(fetcher).toHaveBeenCalledTimes(2);
        stop();
    });

    it("keeps looping after a failed pulse", async () => {
        const fetcher = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(pulse());
        const listener = vi.fn();
        const stop = createPulseLoop(fetcher, () => 0.5).subscribe(listener);
        await vi.advanceTimersByTimeAsync(0);
        expect(listener).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS);
        expect(listener).toHaveBeenCalledTimes(1);
        stop();
    });
});
