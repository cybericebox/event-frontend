import {describe, expect, it} from "vitest";
import {parsePolicyNumber} from "./labPolicyModel";
describe("server-configurable lifecycle policy inputs", () => {
    it("validates nullable active limits and zero retention without product constants", () => {
        expect(parsePolicyNumber("", 1, 1000, true)).toBeNull();
        expect(parsePolicyNumber("0", 0, 10080, false)).toBe(0);
        expect(parsePolicyNumber("1001", 1, 1000, true)).toBeUndefined();
        expect(parsePolicyNumber("60.5", 0, 10080, false)).toBeUndefined();
    });
    it.each(["", "-1", "10081", "NaN", "Infinity"])("rejects invalid retention %s", raw => expect(parsePolicyNumber(raw, 0, 10080, false)).toBeUndefined());
    it("accepts range endpoints and inheritance explicitly", () => {
        expect(parsePolicyNumber("10080", 0, 10080, false)).toBe(10080);
        expect(parsePolicyNumber("  ", 0, 10080, true)).toBeNull();
        expect(parsePolicyNumber("7", 1, 1000, true)).toBe(7);
    });
});
