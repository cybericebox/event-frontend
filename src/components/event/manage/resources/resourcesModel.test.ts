import {describe, expect, it} from "vitest";
import {amountText, buildChangeRequest, emptyDraft, formatCpu, formatGB, formatMemory, shortageBytes} from "./resourcesModel";

const MIB = 1024 ** 2;

const GIB = 1024 ** 3;
const current = {allocated: {CPUMillicores: 2000, MemoryBytes: 8 * GIB}, to: "2026-10-05T13:00:00Z"};

describe("change request draft", () => {
    it("needs at least one of «на скільки більше» and «продовжити до»", () => {
        expect(buildChangeRequest({...emptyDraft, reason: "more teams"}, current)).toEqual({issue: "empty"});
    });

    it("needs a reason", () => {
        expect(buildChangeRequest({...emptyDraft, extraGB: "2"}, current)).toEqual({issue: "reason"});
    });

    it("sends the new total (memory in GB, CPU following it) and omits what is not asked", () => {
        const built = buildChangeRequest({...emptyDraft, extraGB: "2,5", reason: " more teams "}, current);
        expect(built).toEqual({input: {Size: {CPUMillicores: 2000 + 625, MemoryBytes: 10.5 * GIB}, Dynamic: null, WindowStart: null, WindowEnd: null, Reason: "more teams"}});
    });

    it("rejects an extra that is not a positive number", () => {
        expect(buildChangeRequest({...emptyDraft, extraGB: "abc", reason: "x"}, current)).toEqual({issue: "extra"});
        expect(buildChangeRequest({...emptyDraft, extraGB: "0", reason: "x"}, current)).toEqual({issue: "extra"});
    });

    it("rejects an end that is not after the current end of the reserve", () => {
        expect(buildChangeRequest({...emptyDraft, extendTo: "2026-10-05T10:00", reason: "x"}, {...current, to: new Date(2026, 9, 5, 13, 0).toISOString()})).toEqual({issue: "extend"});
    });

    it("accepts an extension alone and sends the end as given", () => {
        const built = buildChangeRequest({...emptyDraft, extendTo: "2026-10-05T18:00", reason: "x"}, {...current, to: new Date(2026, 9, 5, 13, 0).toISOString()});
        expect("input" in built && built.input.WindowEnd).toBe(new Date(2026, 9, 5, 18, 0).toISOString());
        expect("input" in built && built.input.Size).toBeNull();
    });
});

describe("GB format", () => {
    it("reads memory in GB with a decimal comma and a non-breaking space", () => {
        expect(formatGB(3.4 * GIB)).toBe("3,4\u00A0ГБ");
        expect(formatGB(0)).toBe("0\u00A0ГБ");
    });

    it("counts a shortage only when the usage is above the reserve", () => {
        const reserve = {Allocated: {CPUMillicores: 0, MemoryBytes: 8 * GIB}, InUse: {CPUMillicores: 0, MemoryBytes: 8 * GIB}};
        expect(shortageBytes(reserve)).toBe(0);
        expect(shortageBytes({...reserve, InUse: {CPUMillicores: 0, MemoryBytes: 9.5 * GIB}})).toBe(1.5 * GIB);
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
