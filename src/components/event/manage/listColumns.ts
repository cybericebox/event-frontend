import type {ListColumn} from "@/api/manageListColumns";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {isFormField} from "./participantFormEditor";
import {t} from "@/i18n/t";

// One table column: a standard column (key starts with "@") or a form field
// answer column (key = field key). `locked` columns are always shown first.
export type TableColumn = {key: string; label: string; visible: boolean; locked?: boolean};
export type ColumnDefinition = Omit<TableColumn, "visible">;

export function formFields(blocks: FormBlock[] | undefined): FormField[] {
    return (blocks ?? []).filter(isFormField);
}

export function fieldColumnDefinitions(fields: FormField[]): ColumnDefinition[] {
    return fields.map(field => ({key: field.key, label: field.label || field.key}));
}

// Saved order and visibility for columns that still exist; a column missing
// from the saved layout (a new field, or a standard column saved before it
// was configurable) lands right after its default predecessor. Locked
// columns are always visible and first. No saved layout = the defaults.
export function resolveTableColumns(defaults: ColumnDefinition[], saved: ListColumn[]): TableColumn[] {
    const byKey = new Map(defaults.map(column => [column.key, column]));
    const kept: TableColumn[] = [];
    for (const entry of saved) {
        const column = byKey.get(entry.Key);
        if (!column || kept.some(item => item.key === entry.Key)) continue;
        kept.push({...column, visible: column.locked ? true : entry.Visible});
    }
    const result = [...kept.filter(column => column.locked), ...kept.filter(column => !column.locked)];
    defaults.forEach((column, index) => {
        if (result.some(item => item.key === column.key)) return;
        let at = 0;
        for (let previous = index - 1; previous >= 0; previous--) {
            const found = result.findIndex(item => item.key === defaults[previous].key);
            if (found >= 0) {at = found + 1; break;}
        }
        result.splice(at, 0, {...column, visible: true});
    });
    return [...result.filter(column => column.locked), ...result.filter(column => !column.locked)];
}

export function moveColumn(columns: TableColumn[], index: number, target: number): TableColumn[] {
    if (index < 0 || index >= columns.length || target < 0 || target >= columns.length || index === target) return columns;
    if (columns[index].locked || columns[target].locked) return columns;
    const next = [...columns];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
}

export function toSavedColumns(columns: TableColumn[]): ListColumn[] {
    return columns.map(column => ({Key: column.key, Visible: column.locked ? true : column.visible}));
}

export function formatAnswer(value: unknown): string {
    if (value === undefined || value === null || value === "") return "—";
    if (value === true) return t("common.yes");
    if (value === false) return t("common.no");
    if (Array.isArray(value)) return value.map(formatAnswer).join(" · ") || "—";
    if (typeof value === "object" && typeof (value as {name?: unknown}).name === "string") return (value as {name: string}).name || "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}
