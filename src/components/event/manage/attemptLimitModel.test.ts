import {describe, expect, it} from "vitest";
import {parseAttemptLimit} from "./attemptLimitModel";

describe("attempt limit field", () => {
    it("reads an empty field as no value", () => {
        expect(parseAttemptLimit("")).toEqual({valid: true, value: null});
        expect(parseAttemptLimit("  ")).toEqual({valid: true, value: null});
    });

    it("accepts whole numbers from 1 to 1000", () => {
        expect(parseAttemptLimit("1")).toEqual({valid: true, value: 1});
        expect(parseAttemptLimit(" 25 ")).toEqual({valid: true, value: 25});
        expect(parseAttemptLimit("1000")).toEqual({valid: true, value: 1000});
    });

    it("refuses zero, negatives, fractions, text and too large values", () => {
        for (const raw of ["0", "-3", "2.5", "abc", "1001", "1e3x"]) expect(parseAttemptLimit(raw).valid, raw).toBe(false);
    });
});
