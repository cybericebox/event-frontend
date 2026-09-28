import type {LabStatus, ManageStand, StandStatus} from "@/api/manageLabs";

export type StatusTone = "neutral" | "progress" | "ok" | "danger";

export const standStatusLabel: Record<StandStatus, string> = {
    not_deployed: "Не розгорнуто",
    creating: "Створюється",
    ready: "Готово",
    failed: "Помилка",
    removed: "Видалено",
};

export const standStatusTone: Record<StandStatus, StatusTone> = {
    not_deployed: "neutral",
    creating: "progress",
    ready: "ok",
    failed: "danger",
    removed: "neutral",
};

export const labStatusLabel: Record<LabStatus, string> = {
    pending: "Створюється",
    ready: "Готово",
    failed: "Помилка",
    removed: "Видалено",
};

export const labStatusTone: Record<LabStatus, StatusTone> = {
    pending: "progress",
    ready: "ok",
    failed: "danger",
    removed: "neutral",
};

export const readinessLabel = {preparing: "Готується", ready: "Готове, ще не відкрите", available: "Відкрите"} as const;

export function standTeamName(stand: Pick<ManageStand, "Moderators" | "TeamName" | "TeamID">): string {
    if (stand.Moderators) return "Команда модераторів";
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
