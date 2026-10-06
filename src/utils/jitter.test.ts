import {describe, expect, it} from "vitest";
import {jitter} from "./jitter";

describe("jitter", () => {
    it("spreads a delay by ±20 %", () => {
        expect(jitter(10_000, () => 0)).toBe(8000);
        expect(jitter(10_000, () => 0.5)).toBe(10_000);
        expect(jitter(10_000, () => 0.999999)).toBe(12_000);
        for (let i = 0; i < 100; i++) {
            const value = jitter(30_000);
            expect(value).toBeGreaterThanOrEqual(24_000);
            expect(value).toBeLessThanOrEqual(36_000);
        }
    });
});
