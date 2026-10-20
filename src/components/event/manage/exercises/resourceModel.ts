import type {ResourceAmount, TaskResources} from "@/api/manageChallenges";
import {t} from "@/i18n/t";
import {formatCpu, formatMemory} from "../resources/resourcesModel";

export {formatCpu, formatMemory};


function range(min: number, max: number, format: (value: number) => string): string {
    return min === max ? format(max) : `${format(min)}–${format(max)}`;
}

// A set without devices reserves nothing: no line.
export function hasResources(resources: TaskResources | null): resources is TaskResources {
    return resources !== null && resources.Max.Devices > 0;
}

// «CPU 350 мілі-ядер · памʼять 1 ГіБ · пристроїв 4»: a range over the variants when they differ. The server's
// scheduling blocks stay internal: organizers found the word confusing.
// The three ranges of a set's resources over its variants: CPU, memory and the device count.
export function resourceRanges(resources: TaskResources): {cpu: string; memory: string; devices: string} {
    const {Min: min, Max: max} = resources;
    return {cpu: range(min.CPUMillicores, max.CPUMillicores, formatCpu), memory: range(min.MemoryBytes, max.MemoryBytes, formatMemory), devices: range(min.Devices, max.Devices, String)};
}

export function resourcesText(resources: TaskResources): string {
    const {Min: min, Max: max} = resources;
    return t("manage.resources.summary", {
        cpu: range(min.CPUMillicores, max.CPUMillicores, formatCpu),
        memory: range(min.MemoryBytes, max.MemoryBytes, formatMemory),
        devices: range(min.Devices, max.Devices, String),
    });
}

export function amountText(resources: ResourceAmount): string {
    return t("manage.resources.overheadValue", {cpu: formatCpu(resources.CPUMillicores), memory: formatMemory(resources.MemoryBytes)});
}
