"use client";

import {useState, type DragEvent, type ReactNode} from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowDown, ArrowUp, Columns3, GripVertical, SlidersHorizontal} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageListColumns, putManageListColumns, type ListColumns, type ManagedList} from "@/api/manageListColumns";
import type {FormField} from "@/api/manageParticipantForm";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {answerFilterKind, moveColumn, resolveTableColumns, toSavedColumns, type AnswerFilterDraft, type ColumnDefinition, type TableColumn} from "./listColumns";
import {t} from "@/i18n/t";

// The shared (event-wide) column layout of a manage table: order and
// visibility of standard and form field columns. Saving is optimistic.
export function useTableColumns(eventID: string, list: ManagedList, definitions: ColumnDefinition[], canManage: boolean) {
    const queryClient = useQueryClient();
    const queryKey = ["event-management-list-columns", eventID, list];
    const query = useQuery({queryKey, queryFn: () => getManageListColumns(eventID, list), refetchOnWindowFocus: false});
    const columns = resolveTableColumns(definitions, query.data?.Columns ?? []);

    async function save(next: TableColumn[] | null) {
        if (!canManage) return;
        const previous = queryClient.getQueryData<ListColumns>(queryKey);
        const saved = next ? toSavedColumns(next) : [];
        queryClient.setQueryData<ListColumns>(queryKey, {List: list, Columns: saved});
        try {
            queryClient.setQueryData(queryKey, await putManageListColumns(eventID, list, saved));
        } catch {
            queryClient.setQueryData(queryKey, previous);
            toast.error(t("manage.table.columns.saveFailed"));
        }
    }

    return {columns, visible: columns.filter(column => column.visible), save: (next: TableColumn[]) => void save(next), reset: () => void save(null)};
}

function ToolbarPopover({label, icon, count, countLabel, children, className}: {label: string; icon: ReactNode; count?: number; countLabel?: string; children: ReactNode; className?: string}) {
    return <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>
            <button className="ib-btn event-manage-table__tool" type="button" aria-label={count ? countLabel : undefined}>{icon}{label}{!!count && <span className="event-manage-table__tool-count" aria-hidden="true">{count}</span>}</button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content className={`event-manage-table__popover${className ? ` ${className}` : ""}`} align="start" sideOffset={6} collisionPadding={12} aria-label={label}>
                {children}
            </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>;
}

export function TableColumnsPopover({columns, canManage, onChange, onReset}: {
    columns: TableColumn[]; canManage: boolean; onChange: (columns: TableColumn[]) => void; onReset: () => void;
}) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    function drop(event: DragEvent, index: number) {
        event.preventDefault();
        if (dragIndex !== null) onChange(moveColumn(columns, dragIndex, index));
        setDragIndex(null); setOverIndex(null);
    }

    return <ToolbarPopover label={t("manage.table.columns.button")} icon={<Columns3 size={16} aria-hidden="true" />} className="event-manage-table__popover--columns">
        <div className="event-manage-table__popover-head"><strong>{t("manage.table.columns.title")}</strong><small>{t("manage.table.columns.shared")}</small></div>
        <ol className="event-manage-table__columns">{columns.map((column, index) => {
            const movable = canManage && !column.locked;
            return <li key={column.key} className={`${dragIndex === index ? "is-dragging" : ""}${overIndex === index && dragIndex !== index ? " is-over" : ""}`.trim() || undefined}
                draggable={movable} onDragStart={event => {event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", column.key); setDragIndex(index);}}
                onDragOver={event => {if (dragIndex !== null && movable) {event.preventDefault(); setOverIndex(index);}}}
                onDragLeave={() => setOverIndex(current => current === index ? null : current)} onDrop={event => drop(event, index)} onDragEnd={() => {setDragIndex(null); setOverIndex(null);}}>
                <span className={`event-manage-table__grip${movable ? "" : " is-disabled"}`} aria-hidden="true" title={movable ? t("manage.table.columns.drag") : undefined}><GripVertical size={16} /></span>
                <span className="event-manage-table__column-label">{column.label}</span>
                <span className="event-manage-table__column-move">
                    <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.table.columns.moveUp", {label: column.label})} disabled={!movable || index === 0 || columns[index - 1]?.locked} onClick={() => onChange(moveColumn(columns, index, index - 1))}><ArrowUp size={14} /></button>
                    <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.table.columns.moveDown", {label: column.label})} disabled={!movable || index === columns.length - 1} onClick={() => onChange(moveColumn(columns, index, index + 1))}><ArrowDown size={14} /></button>
                </span>
                <EventSwitch checked={column.visible} disabled={!canManage || !!column.locked} ariaLabel={t("manage.table.columns.show", {label: column.label})}
                    onCheckedChange={visible => onChange(columns.map(item => item.key === column.key ? {...item, visible} : item))} />
            </li>;
        })}</ol>
        {canManage && <div className="event-manage-table__popover-foot"><button className="ib-btn ib-btn--sm" type="button" onClick={onReset}>{t("manage.table.columns.reset")}</button></div>}
    </ToolbarPopover>;
}

export function TableFiltersPopover({fields, drafts, onChange, active}: {
    fields: FormField[]; drafts: Record<string, AnswerFilterDraft>; onChange: (drafts: Record<string, AnswerFilterDraft>) => void; active: number;
}) {
    const set = (key: string, draft: AnswerFilterDraft) => onChange({...drafts, [key]: draft});
    return <ToolbarPopover label={t("manage.table.filters.button")} icon={<SlidersHorizontal size={16} aria-hidden="true" />} count={active} countLabel={t("manage.table.filters.buttonActive", {count: active})} className="event-manage-table__popover--filters">
        <div className="event-manage-table__popover-head"><strong>{t("manage.table.filters.title")}</strong></div>
        {fields.length === 0 ? <EmptyState compact message={t("manage.table.filters.noFields")} /> : <div className="event-manage-table__filters">{fields.map(field => {
            const draft = drafts[field.key] ?? {};
            const kind = answerFilterKind(field);
            const label = field.label || field.key;
            return <fieldset key={field.key} className="event-manage-table__filter">
                <legend>{label}</legend>
                {kind === "contains" && <input className="ib-input ib-input--sm" type="search" value={draft.text ?? ""} maxLength={100} placeholder={t("manage.table.filters.contains")} aria-label={t("manage.table.filters.containsLabel", {label})} onChange={event => set(field.key, {text: event.target.value})} />}
                {kind === "any" && <div className="event-manage-table__filter-options">{(field.options ?? []).map(option => <EventCheckbox key={option} label={option} checked={!!draft.values?.includes(option)}
                    onCheckedChange={checked => set(field.key, {values: checked ? [...(draft.values ?? []), option] : (draft.values ?? []).filter(value => value !== option)})} />)}</div>}
                {(kind === "bool" || kind === "present") && <EventSelect ariaLabel={label} value={draft.flag === true ? "yes" : draft.flag === false ? "no" : "any"}
                    onValueChange={value => set(field.key, {flag: value === "any" ? null : value === "yes"})}
                    options={[{value: "any", label: t("manage.table.filters.any")},
                        {value: "yes", label: kind === "bool" ? t("common.yes") : t("manage.table.filters.hasFile")},
                        {value: "no", label: kind === "bool" ? t("common.no") : t("manage.table.filters.noFile")}]} />}
            </fieldset>;
        })}</div>}
    </ToolbarPopover>;
}
