import {t} from "@/i18n/t";

export const groupNameMax = 80;

// Why a group name cannot be saved ("" = it can): required, at most 80
// characters, unique among the event's other groups (case-insensitive).
export function groupNameProblem(name: string, otherNames: string[]): string {
    const trimmed = name.trim();
    if (!trimmed) return t("manage.challenges.groups.nameRequired");
    if (trimmed.length > groupNameMax) return t("manage.challenges.groups.nameTooLong", {max: groupNameMax});
    const lower = trimmed.toLocaleLowerCase("uk");
    if (otherNames.some(other => other.trim().toLocaleLowerCase("uk") === lower)) return t("manage.exercises.groups.exists");
    return "";
}
