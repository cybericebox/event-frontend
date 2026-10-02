import type {EventExerciseAttachment, ResourcePlan, Resources, TaskResources} from "@/api/manageChallenges";
import {t} from "@/i18n/t";

const MIB = 1024 ** 2;

export function formatCpu(millicores: number): string {
    return millicores >= 1000 && millicores % 100 === 0 ? `${millicores / 1000}` : `${millicores}m`;
}

export function formatMemory(bytes: number): string {
    const mebibytes = Math.round(bytes / MIB);
    return mebibytes >= 1024 && mebibytes % 128 === 0 ? `${mebibytes / 1024}Gi` : `${mebibytes}Mi`;
}

function range(min: number, max: number, format: (value: number) => string): string {
    return min === max ? format(max) : `${format(min)}–${format(max)}`;
}

// «350m · 1Gi · 4 пристрої»: a range over the variants when they differ.
export function resourcesText(resources: TaskResources): string {
    const {Min: min, Max: max} = resources;
    return t("manage.resources.summary", {
        cpu: range(min.CPUMillicores, max.CPUMillicores, formatCpu),
        memory: range(min.MemoryBytes, max.MemoryBytes, formatMemory),
        devices: range(min.Devices, max.Devices, String),
    });
}

export function overheadText(resources: Resources): string {
    return t("manage.resources.overheadValue", {cpu: formatCpu(resources.CPUMillicores), memory: formatMemory(resources.MemoryBytes)});
}

export type PlanLine = {id: string; name: string; resources: Resources; heavy: boolean};
export type PlanTotals = {lines: PlanLine[]; overhead: Resources; total: Resources};

const sum = (items: Resources[]): Resources => items.reduce((all, item) => ({
    CPUMillicores: all.CPUMillicores + item.CPUMillicores, MemoryBytes: all.MemoryBytes + item.MemoryBytes, Devices: all.Devices + item.Devices,
}), {CPUMillicores: 0, MemoryBytes: 0, Devices: 0});

// One team's reservation: the largest variant of each set plus the group overhead, which stays a separate line.
export function planTotals(attachments: EventExerciseAttachment[], plan: ResourcePlan): PlanTotals {
    const lines = attachments.filter(attachment => attachment.Resources !== null).map(attachment => ({
        id: attachment.ID, name: attachment.ExerciseName || t("manage.exercises.set"), resources: attachment.Resources!.Max, heavy: attachment.ResourceHeavy,
    }));
    const overhead = sum([plan.Overhead.VPN, plan.Overhead.Gateway]);
    // Overhead devices are pods of the group, not lab devices: they do not add to the device count.
    const tasks = sum(lines.map(line => line.resources));
    return {lines, overhead, total: {CPUMillicores: tasks.CPUMillicores + overhead.CPUMillicores, MemoryBytes: tasks.MemoryBytes + overhead.MemoryBytes, Devices: tasks.Devices}};
}
