"use client";

import {useRef, type ReactNode} from "react";
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
import {Sortable, useSortableItem} from "@/components/ui/Sortable";
import {answerFilterKind, moveColumn, resolveTableColumns, toSavedColumns, type AnswerFilterDraft, type ColumnDefinition, type TableColumn} from "./listColumns";
import {t} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";

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

function ToolbarPopover({label, icon, count, countLabel, children, className, onEscapeKeyDown}: {label: string; icon: ReactNode; count?: number; countLabel?: string; children: ReactNode; className?: string; onEscapeKeyDown?: (event: KeyboardEvent) => void}) {
    return <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>
            <button className="ib-btn event-manage-table__tool" type="button" aria-label={count ? countLabel : undefined}>{icon}{label}{!!count && <span className="event-manage-table__tool-count" aria-hidden="true">{count}</span>}</button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content className={`event-manage-table__popover${className ? ` ${className}` : ""}`} align="start" sideOffset={6} collisionPadding={12} aria-label={label} onEscapeKeyDown={onEscapeKeyDown}>
                {children}
            </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>;
}

export function TableColumnsPopover({columns, canManage, onChange, onReset}: {
    columns: TableColumn[]; canManage: boolean; onChange: (columns: TableColumn[]) => void; onReset: () => void;
}) {
    const move = (from: number, to: number) => onChange(moveColumn(columns, from, to));
    // Escape during a drag cancels the drag only; the popover stays open.
    const dragging = useRef(false);
    return <ToolbarPopover label={t("manage.table.columns.button")} icon={<Columns3 size={16} aria-hidden="true" />} className="event-manage-table__popover--columns"
        onEscapeKeyDown={event => {if (dragging.current) event.preventDefault();}}>
        <div className="event-manage-table__popover-head"><strong>{t("manage.table.columns.title")}</strong><small>{t("manage.table.columns.shared")}</small></div>
        <Sortable ids={columns.map(column => column.key)} itemName={key => columns.find(column => column.key === key)?.label ?? key} onMove={move} onDragStateChange={value => {dragging.current = value;}}>
            <ol className="event-manage-table__columns">{columns.map((column, index) => <ColumnRow key={column.key} columns={columns} index={index} canManage={canManage} move={move}
                onVisibleChange={visible => onChange(columns.map(item => item.key === column.key ? {...item, visible} : item))} />)}</ol>
        </Sortable>
        {canManage && <div className="event-manage-table__popover-foot"><button className="ib-btn ib-btn--sm" type="button" onClick={onReset}>{t("manage.table.columns.reset")}</button></div>}
    </ToolbarPopover>;
}

// A column row is dragged by its whole body (its buttons and switch excepted);
// the grip is the keyboard handle.
function ColumnRow({columns, index, canManage, move, onVisibleChange}: {
    columns: TableColumn[]; index: number; canManage: boolean; move: (from: number, to: number) => void; onVisibleChange: (visible: boolean) => void;
}) {
    const column = columns[index];
    const movable = canManage && !column.locked;
    const sortable = useSortableItem(column.key, !movable);
    return <li {...sortable.itemProps} {...(movable ? sortable.bodyProps : {})} className={movable ? "is-movable" : undefined}>
        {movable ? <EventTooltip content={t("manage.table.columns.drag")} silent>{() => <button type="button" className="event-manage-table__grip" {...sortable.handleProps} aria-label={t("manage.table.columns.dragNamed", {label: column.label})}><GripVertical size={16} aria-hidden="true" /></button>}</EventTooltip>
            : <span className="event-manage-table__grip is-disabled" aria-hidden="true"><GripVertical size={16} /></span>}
        <span className="event-manage-table__column-label">{column.label}</span>
        <span className="event-manage-table__column-move">
            <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.table.columns.moveUp", {label: column.label})} disabled={!movable || index === 0 || columns[index - 1]?.locked} onClick={() => move(index, index - 1)}><ArrowUp size={14} /></button>
            <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.table.columns.moveDown", {label: column.label})} disabled={!movable || index === columns.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={14} /></button>
        </span>
        <EventSwitch checked={column.visible} disabled={!canManage || !!column.locked} ariaLabel={t("manage.table.columns.show", {label: column.label})} onCheckedChange={onVisibleChange} />
    </li>;
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
