import {describe, expect, it} from "vitest";
import type {EventExerciseAttachment, ResourcePlan, Resources} from "@/api/manageChallenges";
import {formatCpu, formatMemory, planTotals, resourcesText} from "./resourceModel";

const res = (cpu: number, mib: number, devices = 0): Resources => ({CPUMillicores: cpu, MemoryBytes: mib * 1024 ** 2, Devices: devices});
const attachment = (id: string, name: string, max: Resources | null, heavy = false) =>
    ({ID: id, ExerciseName: name, ResourceHeavy: heavy, Resources: max && {Min: max, Max: max}}) as EventExerciseAttachment;
const plan: ResourcePlan = {Overhead: {VPN: res(100, 128), Gateway: res(50, 64)}};

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
});

describe("planTotals", () => {
    it("sums the largest variants, keeps the overhead apart and adds both to the total", () => {
        const totals = planTotals([attachment("a", "Web", res(250, 1024, 2), true), attachment("b", "Pwn", res(125, 512, 1)), attachment("c", "No devices", null)], plan);
        expect(totals.lines.map(line => line.name)).toEqual(["Web", "Pwn"]);
        expect(totals.lines[0].heavy).toBe(true);
        expect(totals.overhead).toEqual(res(150, 192));
        expect(totals.total).toEqual(res(250 + 125 + 150, 1024 + 512 + 192, 3));
    });
});
