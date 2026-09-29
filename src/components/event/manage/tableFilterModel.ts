import type {FormField} from "@/api/manageParticipantForm";
import {t} from "@/i18n/t";

// One filter spec per table column: standard columns ("@"-prefixed keys)
// and form fields share one mechanism, sent to the list endpoints as
// `filters` and matched in SQL over the row document.
export type FilterKind = "contains" | "any" | "bool" | "present" | "number" | "date";
export type FilterOption = {value: string; label: string};
export type FilterSpec = {key: string; label: string; kind: FilterKind; options?: FilterOption[]; yes?: string; no?: string};
export type FilterDraft = {text?: string; values?: string[]; flag?: boolean | null; from?: string; to?: string};
export type FilterDrafts = Record<string, FilterDraft>;

export type TableFilter =
    | {Key: string; Op: "contains"; Value: string}
    | {Key: string; Op: "any"; Values: string[]}
    | {Key: string; Op: "bool" | "present"; Value: boolean}
    | {Key: string; Op: "range"; Type: "number" | "date"; From?: number | string; To?: number | string};

export type TableSort = {key: string; desc: boolean};

const dateLabel = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});

export function fieldFilterSpecs(fields: FormField[]): FilterSpec[] {
    return fields.map(field => {
        const input: string = field.input;
        const label = field.label || field.key;
        if (input === "select" || input === "multi_select") return {key: field.key, label, kind: "any", options: (field.options ?? []).map(option => ({value: option, label: option}))};
        if (input === "checkbox") return {key: field.key, label, kind: "bool"};
        if (input === "file") return {key: field.key, label, kind: "present", yes: t("manage.table.filters.hasFile"), no: t("manage.table.filters.noFile")};
        if (input === "number") return {key: field.key, label, kind: "number"};
        return {key: field.key, label, kind: "contains"};
    });
}

function numberBound(value: string | undefined): number | undefined {
    if (value === undefined || value.trim() === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function dateBound(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// The filter of one spec, or null when its draft is empty.
function toFilter(spec: FilterSpec, draft: FilterDraft | undefined): TableFilter | null {
    if (!draft) return null;
    switch (spec.kind) {
    case "contains": {
        const text = draft.text?.trim();
        return text ? {Key: spec.key, Op: "contains", Value: text.slice(0, 100)} : null;
    }
    case "any":
        return draft.values?.length ? {Key: spec.key, Op: "any", Values: draft.values} : null;
    case "bool":
    case "present":
        return typeof draft.flag === "boolean" ? {Key: spec.key, Op: spec.kind, Value: draft.flag} : null;
    case "number": {
        const from = numberBound(draft.from), to = numberBound(draft.to);
        return from === undefined && to === undefined ? null : {Key: spec.key, Op: "range", Type: "number", ...(from === undefined ? {} : {From: from}), ...(to === undefined ? {} : {To: to})};
    }
    case "date": {
        const from = dateBound(draft.from), to = dateBound(draft.to);
        return from === undefined && to === undefined ? null : {Key: spec.key, Op: "range", Type: "date", ...(from === undefined ? {} : {From: from}), ...(to === undefined ? {} : {To: to})};
    }
    }
}

export function toTableFilters(specs: FilterSpec[], drafts: FilterDrafts): TableFilter[] {
    return specs.map(spec => toFilter(spec, drafts[spec.key])).filter((filter): filter is TableFilter => filter !== null);
}

function rangeText(from: string | undefined, to: string | undefined): string {
    if (from && to) return t("manage.table.filters.rangeBoth", {from, to});
    return from ? t("manage.table.filters.rangeFrom", {from}) : t("manage.table.filters.rangeTo", {to: to ?? ""});
}

// One removable chip per active filter: «Label: value».
export function filterChips(specs: FilterSpec[], drafts: FilterDrafts): {key: string; text: string}[] {
    const chips: {key: string; text: string}[] = [];
    for (const spec of specs) {
        const filter = toFilter(spec, drafts[spec.key]);
        if (!filter) continue;
        let value: string;
        if ("Values" in filter) value = filter.Values.map(item => spec.options?.find(option => option.value === item)?.label ?? item).join(", ");
        else if ("Type" in filter) value = filter.Type === "date"
            ? rangeText(filter.From ? dateLabel.format(new Date(filter.From)) : undefined, filter.To ? dateLabel.format(new Date(filter.To)) : undefined)
            : rangeText(filter.From === undefined ? undefined : String(filter.From), filter.To === undefined ? undefined : String(filter.To));
        else if (typeof filter.Value === "string") value = t("manage.table.filters.containsValue", {text: filter.Value});
        else value = filter.Value ? spec.yes ?? t("common.yes") : spec.no ?? t("common.no");
        chips.push({key: spec.key, text: t("manage.table.filters.chip", {label: spec.label, value})});
    }
    return chips;
}

export function withoutFilter(drafts: FilterDrafts, key: string): FilterDrafts {
    const next = {...drafts};
    delete next[key];
    return next;
}

// Header click: a new column sorts ascending, the active one flips.
export function nextSort(current: TableSort, key: string): TableSort {
    return current.key === key ? {key, desc: !current.desc} : {key, desc: false};
}
