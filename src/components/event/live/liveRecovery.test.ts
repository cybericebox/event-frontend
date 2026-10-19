// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {liveConnectionLost, liveRetryDelay, useLiveConnection, useLiveRetry} from "./liveRecovery";

afterEach(() => {vi.useRealTimers();});

describe("live retry", () => {
    it("backs off 5 → 10 → 30 s and keeps retrying every 30 s", () => {
        expect([1, 2, 3, 4, 10].map(liveRetryDelay)).toEqual([5, 10, 30, 30, 30]);
    });

    it("retries a failed load by itself, with longer pauses after each failure", async () => {
        vi.useFakeTimers();
        const retry = vi.fn();
        const {result, rerender} = renderHook(({failed, at}) => useLiveRetry(failed, at, retry), {initialProps: {failed: true, at: 1}});
        await act(async () => {await Promise.resolve();});
        expect(result.current).toBe(5);
        await act(async () => {vi.advanceTimersByTime(3000);});
        expect(result.current).toBe(2);
        expect(retry).not.toHaveBeenCalled();
        await act(async () => {vi.advanceTimersByTime(2000);});
        expect(retry).toHaveBeenCalledTimes(1);
        // The retry failed again: the next pause is 10 s.
        rerender({failed: true, at: 2});
        await act(async () => {vi.advanceTimersByTime(9000);});
        expect(retry).toHaveBeenCalledTimes(1);
        await act(async () => {vi.advanceTimersByTime(1000);});
        expect(retry).toHaveBeenCalledTimes(2);
        rerender({failed: true, at: 3});
        await act(async () => {vi.advanceTimersByTime(30_000);});
        expect(retry).toHaveBeenCalledTimes(3);
        // Success resets the pauses.
        rerender({failed: false, at: 3});
        expect(result.current).toBeNull();
        rerender({failed: true, at: 4});
        await act(async () => {vi.advanceTimersByTime(5000);});
        expect(retry).toHaveBeenCalledTimes(4);
    });
});

describe("live connection mark", () => {
    it("tells the hall only after two refresh intervals, at least 10 s", () => {
        expect(liveConnectionLost(null, 100_000, 5)).toBe(false);
        expect(liveConnectionLost(0, 9_000, 2)).toBe(false);
        expect(liveConnectionLost(0, 10_000, 2)).toBe(true);
        expect(liveConnectionLost(0, 30_000, 20)).toBe(false);
        expect(liveConnectionLost(0, 40_000, 20)).toBe(true);
    });

    it("reports the moment the connection was lost and clears on reconnect", async () => {
        vi.useFakeTimers({now: 1_000_000});
        const {result, rerender} = renderHook(({connected}) => useLiveConnection(connected, 5), {initialProps: {connected: false}});
        await act(async () => {vi.advanceTimersByTime(9000);});
        expect(result.current).toBeNull();
        await act(async () => {vi.advanceTimersByTime(2000);});
        expect(result.current).toBe(1_000_000);
        rerender({connected: true});
        expect(result.current).toBeNull();
    });
});
