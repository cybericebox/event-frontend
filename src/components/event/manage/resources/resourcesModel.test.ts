import {describe, expect, it} from "vitest";
import {buildChangeRequest, emptyDraft, formatCpu, formatMemory} from "./resourcesModel";

const MIB = 1024 ** 2;

describe("change request draft", () => {
    it("needs at least one of size, dynamic estimate and window", () => {
        expect(buildChangeRequest({...emptyDraft, reason: "more teams"})).toEqual({issue: "empty"});
    });

    it("needs a reason", () => {
        expect(buildChangeRequest({...emptyDraft, sizeCpu: "2000", sizeMemory: "4096"})).toEqual({issue: "reason"});
    });

    it("sends size in millicores and bytes, and omits what is not asked", () => {
        const built = buildChangeRequest({...emptyDraft, sizeCpu: "2000", sizeMemory: "4096", reason: " more teams "});
        expect(built).toEqual({input: {Size: {CPUMillicores: 2000, MemoryBytes: 4096 * MIB}, Dynamic: null, WindowStart: null, WindowEnd: null, Reason: "more teams"}});
    });

    it("rejects half an amount", () => {
        expect(buildChangeRequest({...emptyDraft, sizeCpu: "2000", reason: "x"})).toEqual({issue: "size"});
        expect(buildChangeRequest({...emptyDraft, dynamicMemory: "512", reason: "x"})).toEqual({issue: "dynamic"});
    });

    it("rejects a window that ends before it starts", () => {
        expect(buildChangeRequest({...emptyDraft, windowStart: "2026-10-05T12:00", windowEnd: "2026-10-05T10:00", reason: "x"})).toEqual({issue: "window"});
    });

    it("accepts a window alone", () => {
        const built = buildChangeRequest({...emptyDraft, windowEnd: "2026-10-05T18:00", reason: "x"});
        expect("input" in built && built.input.WindowEnd).toBe(new Date(2026, 9, 5, 18, 0).toISOString());
    });
});

describe("amount format", () => {
    it("shows cores and Gi when round", () => {
        expect(formatCpu(2000)).toBe("2");
        expect(formatCpu(250)).toBe("250m");
        expect(formatMemory(4096 * MIB)).toBe("4Gi");
        expect(formatMemory(512 * MIB)).toBe("512Mi");
    });
});
