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
