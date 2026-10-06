import {describe, expect, it, vi} from "vitest";
import {debounce, reconnectDelay, streamFailureLimit, streamMode} from "./eventStream";

describe("event stream helpers", () => {
    it("backs off exponentially up to 30 s", () => {
        expect([1, 2, 3, 4].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000]);
        expect(reconnectDelay(10)).toBe(30_000);
    });

    it("falls back to polling after the failure limit", () => {
        expect(streamMode(0, false)).toBe("connecting");
        expect(streamMode(1, true)).toBe("live");
        expect(streamMode(streamFailureLimit, false)).toBe("fallback");
    });

    it("coalesces bursts into one call", () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const reload = debounce(fn, 1000);
        reload.call(); reload.call(); reload.call();
        vi.advanceTimersByTime(999);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        reload.call(); reload.cancel();
        vi.advanceTimersByTime(2000);
        expect(fn).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
