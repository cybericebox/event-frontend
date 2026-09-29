import type {ListColumn} from "@/api/manageListColumns";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {isFormField} from "./participantFormEditor";
import {t} from "@/i18n/t";

export type FieldColumn = {key: string; label: string; visible: boolean};

export function formFields(blocks: FormBlock[] | undefined): FormField[] {
    return (blocks ?? []).filter(isFormField);
}

// Saved order first (only fields that still exist), then fields added to the
// form later in form order. Without a saved config every field is shown.
export function resolveColumns(fields: {key: string; label: string}[], saved: ListColumn[]): FieldColumn[] {
    const byKey = new Map(fields.map(field => [field.key, field]));
    const seen = new Set<string>();
    const columns: FieldColumn[] = [];
    for (const column of saved) {
        const field = byKey.get(column.Key);
        if (!field || seen.has(column.Key)) continue;
        seen.add(column.Key);
        columns.push({key: field.key, label: field.label || field.key, visible: column.Visible});
    }
    for (const field of fields) if (!seen.has(field.key)) columns.push({key: field.key, label: field.label || field.key, visible: true});
    return columns;
}

export function moveColumn(columns: FieldColumn[], index: number, direction: -1 | 1): FieldColumn[] {
    const target = index + direction;
    if (index < 0 || index >= columns.length || target < 0 || target >= columns.length) return columns;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export function toSavedColumns(columns: FieldColumn[]): ListColumn[] {
    return columns.map(column => ({Key: column.key, Visible: column.visible}));
}

export function formatAnswer(value: unknown): string {
    if (value === undefined || value === null || value === "") return "—";
    if (value === true) return t("common.yes");
    if (value === false) return t("common.no");
    if (Array.isArray(value)) return value.map(formatAnswer).join(" · ") || "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}
