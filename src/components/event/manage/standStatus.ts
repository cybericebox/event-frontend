import type {ManagedLabView} from "@/api/labObservations";
import type {LabStatus, ManageStand, StandStatus} from "@/api/manageLabs";
import {t} from "@/i18n/t";

export type StatusTone = "neutral" | "progress" | "ok" | "danger";

export const standStatusLabel: Record<StandStatus, string> = {
    not_deployed: t("manage.stand.status.notDeployed"),
    creating: t("manage.stand.status.creating"),
    ready: t("manage.stand.status.ready"),
    failed: t("manage.stand.status.failed"),
    removed: t("manage.stand.status.removed"),
};

export const standStatusTone: Record<StandStatus, StatusTone> = {
    not_deployed: "neutral",
    creating: "progress",
    ready: "ok",
    failed: "danger",
    removed: "neutral",
};

export const labStatusLabel: Record<LabStatus, string> = {
    pending: t("manage.stand.status.creating"),
    ready: t("manage.stand.status.ready"),
    failed: t("manage.stand.status.failed"),
    removed: t("manage.stand.status.removed"),
};

export const labStatusTone: Record<LabStatus, StatusTone> = {
    pending: "progress",
    ready: "ok",
    failed: "danger",
    removed: "neutral",
};

export const readinessLabel = {preparing: t("manage.stand.readiness.preparing"), ready: t("manage.stand.readiness.ready"), available: t("manage.stand.readiness.available")} as const;

export function standTeamName(stand: Pick<ManageStand, "Moderators" | "TeamName" | "TeamID">): string {
    if (stand.Moderators) return t("manage.stand.moderatorsTeam");
    return stand.TeamName || stand.TeamID.slice(0, 8);
}

// A stand can be recreated only while it exists in Laboratory.
export function canRecreate(status: StandStatus): boolean {
    return status !== "not_deployed" && status !== "removed";
}

// Moderators first; the backend already orders the rest by public name.
export function orderStands(items: ManageStand[]): ManageStand[] {
    return [...items.filter(item => item.Moderators), ...items.filter(item => !item.Moderators)];
}

// A status from another desired revision/agent or without a valid time is not current proof.
export function hasCurrentLabObservation(lab: ManagedLabView): boolean {
    return lab.Revision === lab.ObservedRevision && lab.AgentUID.trim() !== "" && lab.ObservedAt !== null
        && Number.isFinite(Date.parse(lab.ObservedAt));
}

export function hasCurrentLabAllocation(lab: ManagedLabView): boolean {
    if (!hasCurrentLabObservation(lab) || lab.Resources.ObservedAt === null || !Number.isFinite(Date.parse(lab.Resources.ObservedAt))) return false;
    if (lab.Resources.RuntimeState !== "Released" && lab.Resources.ReleasedRequests.CPUMillicores === "0" && lab.Resources.ReleasedRequests.MemoryBytes === "0") return true;
    // The producer certifies identity/revision and release. Independent timestamps are
    // required evidence fields, not a client-side ordering contract between clocks.
    // Nullable aggregate stop time is display metadata, not a veto on its release certificate.
    return (lab.ActualState === "Stopped" || lab.ActualState === "Deleted")
        && (lab.SnapshotState === "Succeeded" || lab.SnapshotState === "NotRequired")
        && lab.Resources.ReleasedAt !== null && Number.isFinite(Date.parse(lab.Resources.ReleasedAt));
}
