"use client";

import type {ReactNode} from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal, X} from "lucide-react";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {EventTimePicker} from "@/components/ui/EventTimePicker";
import {EventSelect} from "@/components/ui/EventSelect";
import {filterChips, nextSort, NUMBER_OPS, TEXT_OPS, withoutFilter, type FilterDraft, type FilterDrafts, type FilterSpec, type TableSort} from "./tableFilterModel";
import {t} from "@/i18n/t";
import "./tableFilters.css";

function FilterControl({spec, draft, onChange}: {spec: FilterSpec; draft: FilterDraft; onChange: (draft: FilterDraft) => void}) {
    switch (spec.kind) {
    case "contains": {
        const op = draft.op ?? "contains";
        return <div className="event-table-filters__row">
            <EventSelect className="event-table-filters__op" ariaLabel={t("manage.table.filters.opLabel", {label: spec.label})} value={op} onValueChange={value => onChange({op: value, text: value === "contains" ? draft.text : undefined})}
                options={TEXT_OPS.map(value => ({value, label: t(`manage.table.filters.op.${value}`)}))} />
            {op === "contains" && <input className="ib-input" type="search" value={draft.text ?? ""} maxLength={100} placeholder={t("manage.table.filters.contains")}
                aria-label={t("manage.table.filters.containsLabel", {label: spec.label})} onChange={event => onChange({op, text: event.target.value})} />}
        </div>;
    }
    case "any":
        return <div className="event-table-filters__options">{(spec.options ?? []).map(option => <EventCheckbox key={option.value} label={option.label} checked={!!draft.values?.includes(option.value)}
            onCheckedChange={checked => onChange({values: checked ? [...(draft.values ?? []), option.value] : (draft.values ?? []).filter(value => value !== option.value)})} />)}</div>;
    case "bool":
    case "present":
        return <EventSelect ariaLabel={spec.label} value={draft.flag === true ? "yes" : draft.flag === false ? "no" : "any"} onValueChange={value => onChange({flag: value === "any" ? null : value === "yes"})}
            options={[{value: "any", label: t("manage.table.filters.any")}, {value: "yes", label: spec.yes ?? t("common.yes")}, {value: "no", label: spec.no ?? t("common.no")}]} />;
    case "number": {
        const op = draft.op ?? "eq";
        return <div className="event-table-filters__row">
            <EventSelect className="event-table-filters__op" ariaLabel={t("manage.table.filters.opLabel", {label: spec.label})} value={op} onValueChange={value => onChange({...draft, op: value})}
                options={NUMBER_OPS.map(value => ({value, label: t(`manage.table.filters.op.${value}`)}))} />
            {op === "between" ? <div className="event-table-filters__range">
                <input className="ib-input" type="number" value={draft.from ?? ""} placeholder={t("manage.table.filters.min")} aria-label={t("manage.table.filters.fromLabel", {label: spec.label})} onChange={event => onChange({...draft, from: event.target.value})} />
                <input className="ib-input" type="number" value={draft.to ?? ""} placeholder={t("manage.table.filters.max")} aria-label={t("manage.table.filters.toLabel", {label: spec.label})} onChange={event => onChange({...draft, to: event.target.value})} />
            </div> : <input className="ib-input" type="number" value={draft.from ?? ""} aria-label={t("manage.table.filters.valueLabel", {label: spec.label})} onChange={event => onChange({...draft, from: event.target.value})} />}
        </div>;
    }
    case "date":
        if (spec.mode === "time") return <div className="event-table-filters__range">
            <EventTimePicker allowClear value={draft.from ?? ""} ariaLabel={t("manage.table.filters.fromLabel", {label: spec.label})} onChange={value => onChange({...draft, from: value})} />
            <EventTimePicker allowClear value={draft.to ?? ""} ariaLabel={t("manage.table.filters.toLabel", {label: spec.label})} onChange={value => onChange({...draft, to: value})} />
        </div>;
        return <div className="event-table-filters__range event-table-filters__range--dates">
            <EventDateTimePicker allowClear dateOnly={spec.mode === "date"} value={draft.from ?? ""} placeholder={t("manage.table.filters.from")} ariaLabel={t("manage.table.filters.fromLabel", {label: spec.label})} onChange={value => onChange({...draft, from: value})} />
            <EventDateTimePicker allowClear dateOnly={spec.mode === "date"} value={draft.to ?? ""} placeholder={t("manage.table.filters.to")} ariaLabel={t("manage.table.filters.toLabel", {label: spec.label})} onChange={value => onChange({...draft, to: value})} />
        </div>;
    }
}

// «Фільтри»: one popover for every column of the table, by column type.
export function TableFiltersButton({specs, drafts, onChange, active}: {specs: FilterSpec[]; drafts: FilterDrafts; onChange: (drafts: FilterDrafts) => void; active: number}) {
    return <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>
            <button className="ib-btn event-manage-table__tool" type="button" aria-label={active ? t("manage.table.filters.buttonActive", {count: active}) : undefined}>
                <SlidersHorizontal size={16} aria-hidden="true" />{t("manage.table.filters.button")}{active > 0 && <span className="event-manage-table__tool-count" aria-hidden="true">{active}</span>}
            </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content className="event-manage-table__popover event-table-filters" align="start" sideOffset={6} collisionPadding={12} aria-label={t("manage.table.filters.button")}>
                <div className="event-manage-table__popover-head"><strong>{t("manage.table.filters.title")}</strong></div>
                {specs.length === 0 ? <EmptyState compact message={t("manage.table.filters.noFields")} /> : <div className="event-table-filters__list">{specs.map(spec => <fieldset key={spec.key} className="event-table-filters__item">
                    <legend>{spec.label}</legend>
                    <FilterControl spec={spec} draft={drafts[spec.key] ?? {}} onChange={draft => onChange({...drafts, [spec.key]: draft})} />
                </fieldset>)}</div>}
            </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>;
}

// Active filters above the table as removable chips, plus «Скинути фільтри».
export function TableFilterChips({specs, drafts, onChange, onReset, extra}: {specs: FilterSpec[]; drafts: FilterDrafts; onChange: (drafts: FilterDrafts) => void; onReset: () => void; extra?: {key: string; text: string; onRemove: () => void}[]}) {
    const chips = [...(extra ?? []), ...filterChips(specs, drafts).map(chip => ({...chip, onRemove: () => onChange(withoutFilter(drafts, chip.key))}))];
    if (chips.length === 0) return null;
    return <div className="event-table-filters__chips" role="group" aria-label={t("manage.table.filters.active")}>
        {chips.map(chip => <span key={chip.key} className="event-table-filters__chip"><span>{chip.text}</span>
            <button type="button" className="event-table-filters__chip-remove" aria-label={t("manage.table.filters.remove", {filter: chip.text})} onClick={chip.onRemove}><X size={14} aria-hidden="true" /></button>
        </span>)}
        <button className="ib-btn ib-btn--sm ib-btn--ghost" type="button" onClick={onReset}>{t("manage.table.filters.reset")}</button>
    </div>;
}

// A sortable column header: click toggles asc/desc, aria-sort reflects it.
export function SortHeader({columnKey, label, sort, onSort, sortable = true, children}: {columnKey: string; label: string; sort: TableSort; onSort: (sort: TableSort) => void; sortable?: boolean; children?: ReactNode}) {
    if (!sortable) return <th scope="col">{label}{children}</th>;
    const active = sort.key === columnKey;
    const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
    return <th scope="col" aria-sort={active ? sort.desc ? "descending" : "ascending" : "none"}>
        <button type="button" className={`event-table-filters__sort${active ? " is-active" : ""}`} onClick={() => onSort(nextSort(sort, columnKey))}>{label}<Icon size={14} aria-hidden="true" /></button>
        {children}
    </th>;
}
