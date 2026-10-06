import type {LabQueue, LiveDevice} from "@/api/manageLabs";
import {t} from "@/i18n/t";

// The backend sends reasons as English codes; the UI never shows them raw.
const QUEUE_REASONS = new Set(["InFlightLimit", "WaitingForGroup", "WaitingForTurn", "PreparingImages", "InsufficientResources", "NoSchedulableNodes", "TenantQuota"]);
const FAILURE_REASONS = new Set(["ImagePull", "CrashLoop", "Unschedulable", "StartupTimeout", "DoesNotFit"]);

// «Лабораторія в черзі: N із M» + the reason. Null when the lab is not waiting for a turn:
// no queue, or Position 0 (every pod is already dispatched).
export function queueLine(queue: Pick<LabQueue, "Position" | "Length" | "Reason"> | null | undefined): string | null {
    if (!queue || queue.Position <= 0) return null;
    const reason = t(QUEUE_REASONS.has(queue.Reason) ? `lab.queue.reason.${queue.Reason}` : "lab.queue.reason.unknown");
    return t("lab.queue.status", {position: queue.Position, length: queue.Length, reason});
}

export function failureReasonLabel(reason: string): string {
    return t(FAILURE_REASONS.has(reason) ? `lab.live.failure.${reason}` : "lab.live.failure.unknown");
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
