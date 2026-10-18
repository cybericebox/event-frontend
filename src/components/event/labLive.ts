import type {LabQueue, LiveDevice} from "@/api/manageLabs";
import {t} from "@/i18n/t";

// The backend sends reasons as English codes; the UI never shows them raw.
// Reasons that mean the cluster has no room; participants see «not enough resources», never the code.
const QUEUE_REASONS = new Set(["InFlightLimit", "WaitingForGroup", "PreparingImages", "InsufficientResources", "NoSchedulableNodes", "TenantQuota"]);
const NO_RESOURCES_REASONS = new Set(["InsufficientResources", "NoSchedulableNodes", "TenantQuota"]);
const FAILURE_REASONS = new Set(["ImagePull", "ImageUnavailable", "CrashLoop", "Unschedulable", "StartupTimeout", "DoesNotFit"]);

// How long a starting lab may take before the participant gets a reassuring second line.
export const LONG_WAIT_MS = 30_000;

// The second line of a starting lab: null before the long wait, then «not enough resources» for a resource
// reason or the generic «almost there». Never a queue position or a raw reason.
export function startingNote(queue: Pick<LabQueue, "Reason"> | null | undefined, longWait: boolean): string | null {
    if (!longWait) return null;
    return t(queue && NO_RESOURCES_REASONS.has(queue.Reason) ? "lab.starting.noResources" : "lab.starting.longWait");
}

// Staff view: where the lab stands in the queue, with the reason. Null when it is not waiting for a turn
// (no queue, or Position 0: every pod is already dispatched). WaitingForTurn adds nothing beyond the queue place.
export function queueLineStaff(queue: Pick<LabQueue, "Position" | "Reason"> | null | undefined): string | null {
    if (!queue || queue.Position <= 0) return null;
    const ahead = queue.Position - 1;
    const place = ahead === 0 ? t("lab.queue.next") : t("lab.queue.ahead", {ahead});
    if (queue.Reason === "WaitingForTurn") return place;
    return `${place} ${t(QUEUE_REASONS.has(queue.Reason) ? `lab.queue.reason.${queue.Reason}` : "lab.queue.reason.unknown")}`;
}

export function failureReasonLabel(reason: string): string {
    return t(FAILURE_REASONS.has(reason) ? `lab.live.failure.${reason}` : "lab.live.failure.unknown");
}

// A stand reason as stored: "ImageUnavailable: <image>" reads as a sentence, anything else stays as it is.
export function standReasonText(reason: string): string {
    const match = /^ImageUnavailable(?::\s*(.*))?$/.exec(reason.trim());
    if (!match) return reason;
    return match[1] ? t("lab.live.imageUnavailable.image", {image: match[1]}) : t("lab.live.imageUnavailable");
}

export function failedDevices(devices: LiveDevice[]): LiveDevice[] {
    return devices.filter(device => device.Scheduling?.Failure);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];

// «5 хвилин тому» in the active language (Ukrainian).
export function agoText(iso: string, now = Date.now()): string {
    const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
    const [unit, size] = UNITS.find(([, size]) => seconds >= size) ?? UNITS[UNITS.length - 1];
    return new Intl.RelativeTimeFormat("uk", {numeric: "auto"}).format(-Math.floor(seconds / size), unit);
}

export function sizeText(bytes: number): string {
    if (bytes >= 1024 ** 3) return t("lab.live.size.gb", {n: (bytes / 1024 ** 3).toFixed(1)});
    if (bytes >= 1024 ** 2) return t("lab.live.size.mb", {n: (bytes / 1024 ** 2).toFixed(1)});
    if (bytes >= 1024) return t("lab.live.size.kb", {n: Math.round(bytes / 1024)});
    return t("lab.live.size.b", {n: bytes});
}

export function deviceStateLabel(device: LiveDevice): string {
    if (device.Ready) return t("lab.live.state.ready");
    const state = device.Scheduling?.State;
    return t(state === "Queued" || state === "Starting" || state === "Failed" ? `lab.live.state.${state}` : "lab.live.state.waiting");
}
