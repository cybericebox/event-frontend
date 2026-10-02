import {describe, expect, it} from "vitest";
import type {TaskResources} from "@/api/manageChallenges";
import {amountText, formatCpu, formatMemory, hasResources, resourcesText} from "./resourceModel";

const res = (cpu: number, mib: number, devices: number) => ({CPUMillicores: cpu, MemoryBytes: mib * 1024 ** 2, Devices: devices});

describe("resource formatting", () => {
    it("formats CPU and memory", () => {
        expect(formatCpu(250)).toBe("250m");
        expect(formatCpu(1000)).toBe("1");
        expect(formatCpu(1500)).toBe("1.5");
        expect(formatMemory(64 * 1024 ** 2)).toBe("64Mi");
        expect(formatMemory(1024 ** 3)).toBe("1Gi");
        expect(formatMemory(1536 * 1024 ** 2)).toBe("1.5Gi");
    });

    it("shows a range only when the variants differ", () => {
        expect(resourcesText({Min: res(250, 1024, 2), Max: res(250, 1024, 2)})).toBe("CPU 250m · памʼять 1Gi · пристроїв 2");
        expect(resourcesText({Min: res(50, 128, 1), Max: res(250, 1024, 3)})).toBe("CPU 50m–250m · памʼять 128Mi–1Gi · пристроїв 1–3");
    });

    it("formats a group pod amount", () => {
        expect(amountText({CPUMillicores: 100, MemoryBytes: 128 * 1024 ** 2})).toBe("CPU 100m · памʼять 128Mi");
    });

    it("counts a set without devices as having no resources", () => {
        expect(hasResources(null)).toBe(false);
        expect(hasResources({Min: res(0, 0, 0), Max: res(0, 0, 0)} as TaskResources)).toBe(false);
        expect(hasResources({Min: res(25, 64, 1), Max: res(25, 64, 1)})).toBe(true);
    });
});
