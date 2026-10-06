import {describe, expect, it} from "vitest";
import type {TaskResources} from "@/api/manageChallenges";
import {amountText, formatCpu, formatMemory, hasResources, resourcesText} from "./resourceModel";

const res = (cpu: number, mib: number, devices: number, blocks = devices * 4) => ({Blocks: blocks, CPUMillicores: cpu, MemoryBytes: mib * 1024 ** 2, Devices: devices});

describe("resource formatting", () => {
    it("formats CPU and memory with the shared resources formatter", () => {
        expect(formatCpu(250)).toBe("250 мілі-ядер");
        expect(formatCpu(1500)).toBe("1,5 vCPU");
        expect(formatMemory(64 * 1024 ** 2)).toBe("64 МіБ");
        expect(formatMemory(1024 ** 3)).toBe("1 ГіБ");
    });

    it("shows a range only when the variants differ", () => {
        expect(resourcesText({Min: res(250, 1024, 2), Max: res(250, 1024, 2)})).toBe("CPU 250 мілі-ядер · памʼять 1 ГіБ · 8 блоків · пристроїв 2");
        expect(resourcesText({Min: res(50, 128, 1), Max: res(250, 1024, 3)})).toBe("CPU 50 мілі-ядер–250 мілі-ядер · памʼять 128 МіБ–1 ГіБ · 4–12 блоків · пристроїв 1–3");
    });

    it("formats a group pod amount", () => {
        expect(amountText({Blocks: 2, CPUMillicores: 100, MemoryBytes: 128 * 1024 ** 2})).toBe("CPU 100 мілі-ядер · памʼять 128 МіБ · 2 блоки");
    });

    it("counts a set without devices as having no resources", () => {
        expect(hasResources(null)).toBe(false);
        expect(hasResources({Min: res(0, 0, 0), Max: res(0, 0, 0)} as TaskResources)).toBe(false);
        expect(hasResources({Min: res(25, 64, 1), Max: res(25, 64, 1)})).toBe(true);
    });
});
