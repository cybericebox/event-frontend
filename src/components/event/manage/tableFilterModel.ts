import type {FormField} from "@/api/manageParticipantForm";
import {dateModeOf} from "./participantFormEditor";
import {t} from "@/i18n/t";

// One filter spec per table column: standard columns ("@"-prefixed keys)
// and form fields share one mechanism, sent to the list endpoints as
// `filters` and matched in SQL over the row document.
export type FilterKind = "contains" | "any" | "bool" | "present" | "number" | "date";
export type FilterOption = {value: string; label: string};
// `mode` of a date filter: a calendar day, a time of day or both (default).
export type DateMode = "date" | "time" | "datetime";
export type FilterSpec = {key: string; label: string; kind: FilterKind; mode?: DateMode; options?: FilterOption[]; yes?: string; no?: string};
// `op` picks the operator of a text ("contains" | "empty" | "notEmpty") or a
// number ("eq" | "gt" | "lt" | "between") filter.
export type FilterDraft = {op?: string; text?: string; values?: string[]; flag?: boolean | null; from?: string; to?: string};
export const TEXT_OPS = ["contains", "empty", "notEmpty"] as const;
export const NUMBER_OPS = ["eq", "gt", "lt", "between"] as const;
export type FilterDrafts = Record<string, FilterDraft>;

export type TableFilter =
    | {Key: string; Op: "contains"; Value: string}
    | {Key: string; Op: "any"; Values: string[]}
    | {Key: string; Op: "bool" | "present"; Value: boolean}
    | {Key: string; Op: "range"; Type: "number" | "date" | "time"; From?: number | string; To?: number | string; FromExclusive?: boolean; ToExclusive?: boolean};

export type TableSort = {key: string; desc: boolean};

const dateLabel = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});
const dayLabel = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium"});

export function fieldFilterSpecs(fields: FormField[]): FilterSpec[] {
    return fields.map(field => {
        const input: string = field.input;
        const label = field.label || field.key;
        if (input === "select" || input === "multi_select") return {key: field.key, label, kind: "any", options: (field.options ?? []).map(option => ({value: option, label: option}))};
        if (input === "checkbox") return {key: field.key, label, kind: "bool"};
        if (input === "file") return {key: field.key, label, kind: "present", yes: t("manage.table.filters.hasFile"), no: t("manage.table.filters.noFile")};
        if (input === "number") return {key: field.key, label, kind: "number"};
        if (input === "date") return {key: field.key, label, kind: "date", mode: dateModeOf(field)};
        return {key: field.key, label, kind: "contains"};
    });
}

function numberBound(value: string | undefined): number | undefined {
    if (value === undefined || value.trim() === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

// Bounds as the backend takes them: "HH:MM" for times, "YYYY-MM-DD" for
// days, UTC ISO for date and time (picked in the viewer's own zone).
function dateBound(value: string | undefined, mode: DateMode = "datetime"): string | undefined {
    if (!value) return undefined;
    if (mode === "time") return /^\d{2}:\d{2}$/.test(value) ? value : undefined;
    if (mode === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// The filter of one spec, or null when its draft is empty.
function toFilter(spec: FilterSpec, draft: FilterDraft | undefined): TableFilter | null {
    if (!draft) return null;
    switch (spec.kind) {
    case "contains": {
        if (draft.op === "empty" || draft.op === "notEmpty") return {Key: spec.key, Op: "present", Value: draft.op === "notEmpty"};
        const text = draft.text?.trim();
        return text ? {Key: spec.key, Op: "contains", Value: text.slice(0, 100)} : null;
    }
    case "any":
        return draft.values?.length ? {Key: spec.key, Op: "any", Values: draft.values} : null;
    case "bool":
    case "present":
        return typeof draft.flag === "boolean" ? {Key: spec.key, Op: spec.kind, Value: draft.flag} : null;
    case "number": {
        const op = draft.op ?? "eq";
        const from = numberBound(draft.from), to = numberBound(draft.to);
        if (op !== "between") {
            if (from === undefined) return null;
            if (op === "gt") return {Key: spec.key, Op: "range", Type: "number", From: from, FromExclusive: true};
            if (op === "lt") return {Key: spec.key, Op: "range", Type: "number", To: from, ToExclusive: true};
            return {Key: spec.key, Op: "range", Type: "number", From: from, To: from};
        }
        return from === undefined && to === undefined ? null : {Key: spec.key, Op: "range", Type: "number", ...(from === undefined ? {} : {From: from}), ...(to === undefined ? {} : {To: to})};
    }
    case "date": {
        const from = dateBound(draft.from, spec.mode), to = dateBound(draft.to, spec.mode);
        const type = spec.mode === "time" ? "time" : "date";
        return from === undefined && to === undefined ? null : {Key: spec.key, Op: "range", Type: type, ...(from === undefined ? {} : {From: from}), ...(to === undefined ? {} : {To: to})};
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
        if (filter.Op === "present" && spec.kind === "contains") value = filter.Value ? t("manage.table.filters.notEmpty") : t("manage.table.filters.empty");
        else if ("Type" in filter && filter.Type === "number" && filter.From !== undefined && filter.From === filter.To) value = t("manage.table.filters.eqValue", {value: String(filter.From)});
        else if ("Type" in filter && filter.FromExclusive) value = t("manage.table.filters.gtValue", {value: String(filter.From)});
        else if ("Type" in filter && filter.ToExclusive) value = t("manage.table.filters.ltValue", {value: String(filter.To)});
        else if ("Values" in filter) value = filter.Values.map(item => spec.options?.find(option => option.value === item)?.label ?? item).join(", ");
        else if ("Type" in filter) {
            const show = (bound: number | string | undefined) => bound === undefined ? undefined
                : filter.Type === "date" && (spec.mode ?? "datetime") === "datetime" ? dateLabel.format(new Date(bound))
                    : filter.Type === "date" ? dayLabel.format(new Date(`${bound}T00:00`)) : String(bound);
            value = rangeText(show(filter.From), show(filter.To));
        }
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
