import {describe, expect, it} from "vitest";
import {buildChangeRequest, emptyDraft, amountText, formatCpu, formatMemory} from "./resourcesModel";

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
    it("reads CPU in milli-cores with uk plurals below one core, vCPU from one", () => {
        expect(formatCpu(0)).toBe("0 vCPU");
        expect(formatCpu(1)).toBe("1 мілі-ядро");
        expect(formatCpu(250)).toBe("250 мілі-ядер");
        expect(formatCpu(522)).toBe("522 мілі-ядра");
        expect(formatCpu(1500)).toBe("1,5 vCPU");
        expect(formatCpu(2000)).toBe("2 vCPU");
    });

    it("reads memory in МіБ and ГіБ with a decimal comma", () => {
        expect(formatMemory(512 * MIB)).toBe("512 МіБ");
        expect(formatMemory(3.375 * 1024 * MIB)).toBe("3,4 ГіБ");
        expect(formatMemory(0)).toBe("0 Б");
    });

    it("joins both for people, never raw Kubernetes strings", () => {
        expect(amountText({CPUMillicores: 828, MemoryBytes: 3.375 * 1024 * MIB})).toBe("828 мілі-ядер · 3,4 ГіБ");
        expect(amountText({CPUMillicores: 0, MemoryBytes: 0})).not.toMatch(/\d(m|Mi|Gi)\b/);
    });
});
