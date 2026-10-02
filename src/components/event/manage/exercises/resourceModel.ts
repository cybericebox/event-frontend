import type {ResourceAmount, TaskResources} from "@/api/manageChallenges";
import {t, tPlural} from "@/i18n/t";

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

// «3 блоки»: the server's block count; the plural follows the larger end of a range.
export function blocksText(min: number, max = min): string {
    return tPlural("manage.resources.blocks", max, {value: range(min, max, String)});
}

// A set without devices reserves nothing: no line.
export function hasResources(resources: TaskResources | null): resources is TaskResources {
    return resources !== null && resources.Max.Devices > 0;
}

// «350m · 1Gi · 4 пристрої»: a range over the variants when they differ.
export function resourcesText(resources: TaskResources): string {
    const {Min: min, Max: max} = resources;
    return t("manage.resources.summary", {
        cpu: range(min.CPUMillicores, max.CPUMillicores, formatCpu),
        memory: range(min.MemoryBytes, max.MemoryBytes, formatMemory),
        blocks: blocksText(min.Blocks, max.Blocks),
        devices: range(min.Devices, max.Devices, String),
    });
}

export function amountText(resources: ResourceAmount): string {
    return t("manage.resources.overheadValue", {cpu: formatCpu(resources.CPUMillicores), memory: formatMemory(resources.MemoryBytes), blocks: blocksText(resources.Blocks)});
}
