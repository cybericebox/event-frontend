import type {LabQueue, LiveDevice} from "@/api/manageLabs";
import {formatClock} from "@/components/event/challenges/challengeBoardModel";
import {t} from "@/i18n/t";

// The backend sends reasons as English codes; the UI never shows them raw.
// Reasons that mean the cluster has no room; participants see «not enough resources», never the code.
const QUEUE_REASONS = new Set(["InFlightLimit", "WaitingForGroup", "PreparingImages", "InsufficientResources", "NoSchedulableNodes", "TenantQuota",
    "DoesNotFitNow", "ReservationMissing", "ReservationNotActive", "ReservationFull"]);
const NO_RESOURCES_REASONS = new Set(["InsufficientResources", "NoSchedulableNodes", "TenantQuota", "DoesNotFitNow", "ReservationMissing",
    "ReservationNotActive", "ReservationFull", "Withdrawn"]);
const FAILURE_REASONS = new Set(["ImagePull", "ImageUnavailable", "CrashLoop", "Unschedulable", "StartupTimeout", "DoesNotFit"]);

// How long a starting lab may take before the participant gets a reassuring second line.
export const LONG_WAIT_MS = 30_000;

// The second line of a starting lab: null before the long wait, then «not enough resources» for a resource
// reason or the generic «almost there». Never a queue position or a raw reason.
// A lab that waits for a new cluster node gets its own calm line: participants never hear about nodes.
export function startingNote(queue: Pick<LabQueue, "Reason"> | null | undefined, longWait: boolean): string | null {
    if (!longWait) return null;
    if (queue?.Reason === "NodeStarting") return t("lab.starting.nodeStarting");
    return t(queue && NO_RESOURCES_REASONS.has(queue.Reason) ? "lab.starting.noResources" : "lab.starting.longWait");
}

type StaffQueue = Pick<LabQueue, "Position" | "Reason"> & Partial<Pick<LabQueue, "Attempt" | "RetryAt" | "WaitingSince">>;

// Staff view: where the lab stands in the queue, with the reason. Null when it is not waiting for a turn
// (no queue, or Position 0: every pod is already dispatched), except a lab whose sent pods wait for a new
// cluster node. WaitingForTurn adds nothing beyond the queue place.
export function queueLineStaff(queue: StaffQueue | null | undefined): string | null {
    if (queue?.Reason === "NodeStarting") {
        return queue.WaitingSince ? t("lab.queue.reason.NodeStarting.since", {time: formatClock(queue.WaitingSince)}) : t("lab.queue.reason.NodeStarting");
    }
    if (!queue || queue.Position <= 0) return null;
    const ahead = queue.Position - 1;
    const place = ahead === 0 ? t("lab.queue.next") : t("lab.queue.ahead", {ahead});
    if (queue.Reason === "WaitingForTurn") return place;
    return `${place} ${queue.Reason === "Withdrawn" ? withdrawnLine(queue) : t(QUEUE_REASONS.has(queue.Reason) ? `lab.queue.reason.${queue.Reason}` : "lab.queue.reason.unknown")}`;
}

// The labs of a stand its queue line speaks about: the ones waiting for a new node when that is the reason, else the queued ones.
export function standQueueLabs(queue: {QueuedLabs: number; Reason: string; NodeStartingLabs: number} | null | undefined): number {
    if (!queue) return 0;
    return queue.Reason === "NodeStarting" ? queue.NodeStartingLabs : queue.QueuedLabs;
}

// A withdrawn launch: not every pod of its group got a node within the node timeout, so the group waits for a retry.
function withdrawnLine(queue: StaffQueue): string {
    if (!queue.Attempt || !queue.RetryAt) return t("lab.queue.reason.Withdrawn");
    return t("lab.queue.reason.Withdrawn.retry", {attempt: queue.Attempt, time: formatClock(queue.RetryAt)});
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
