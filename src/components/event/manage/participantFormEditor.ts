import type {ConditionOperator, FileKind, FormBlock, FormDocument, FormField} from "@/api/manageParticipantForm";
import {richTextHasContent} from "../content/richTextState";
import {t} from "@/i18n/t";

export function isFormField(block: FormBlock): block is FormField { return block.type === "field"; }

export function isChoiceInput(input: FormField["input"]): boolean { return input === "select" || input === "multi_select"; }

// «Файл» questions: the formats an organizer may allow and the size limits,
// the same as the backend (eventFormModel.MaxAnswerFileMB).
export const fileKinds: FileKind[] = ["pdf", "image", "word", "excel", "powerpoint", "text", "archive"];
export const officeFileKinds: FileKind[] = ["word", "excel", "powerpoint"];
export const defaultFileMB = 10;
export const maxFileMB = 25;

// Fields a question of this answer type carries besides the common ones.
type InputSettings = Pick<FormField, "options" | "fileTypes" | "maxSizeMB" | "dateMode" | "minDate" | "maxDate">;
const noSettings: InputSettings = {options: undefined, fileTypes: undefined, maxSizeMB: undefined, dateMode: undefined, minDate: undefined, maxDate: undefined};

function inputSettings(input: FormField["input"], field?: FormField): InputSettings {
    if (isChoiceInput(input)) return {...noSettings, options: field?.options?.length ? field.options : [""]};
    if (input === "file") return {...noSettings, fileTypes: field?.fileTypes?.length ? field.fileTypes : ["pdf"], maxSizeMB: field?.maxSizeMB ?? defaultFileMB};
    if (input === "date") return {...noSettings, dateMode: "date"};
    return noSettings;
}

// «Дата / час» answers: a day ("YYYY-MM-DD"), a time of day ("HH:MM") or a
// UTC ISO datetime, as the backend (eventFormModel.ParseDateAnswer) reads them.
export function dateModeOf(field: FormField): "date" | "time" | "datetime" {
    return field.dateMode === "datetime" || field.dateMode === "time" ? field.dateMode : "date";
}

// The mode for the ticked parts; neither ticked is "none", which cannot be saved.
export function dateModeFor(parts: {date: boolean; time: boolean}): NonNullable<FormField["dateMode"]> {
    return parts.date && parts.time ? "datetime" : parts.date ? "date" : parts.time ? "time" : "none";
}

export function parseDateAnswer(mode: "date" | "time" | "datetime", value: unknown): number | null {
    if (typeof value !== "string") return null;
    if (mode === "time") {
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    }
    if (mode === "date") {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) return null;
        const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return new Date(at).toISOString().slice(0, 10) === value ? at : null;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(value)) return null;
    const at = Date.parse(value);
    return Number.isNaN(at) ? null : at;
}

// Operators of a condition on this source: dates also compare in time.
export function conditionOperators(source: FormField | undefined): ConditionOperator[] {
    return source?.input === "date" ? ["equals", "not_equals", "before", "after"] : ["equals", "not_equals"];
}

export function createFormField(input: FormField["input"] = "text"): FormField {
    return {id: `field-${crypto.randomUUID()}`, type: "field", key: `field_${crypto.randomUUID().replaceAll("-", "")}`, input, label: "", required: false, ...inputSettings(input)};
}

// A condition may depend only on an earlier question with one comparable
// answer: not a multi-select and not a file.
function comparableInput(input: FormField["input"]): boolean { return input !== "multi_select" && input !== "file"; }

// A participant question cannot depend on a staff-only one (participants never see it).
export function conditionSources(blocks: FormBlock[], index: number): FormField[] {
    const dependent = blocks[index];
    const staff = !!dependent && isFormField(dependent) && !!dependent.staffOnly;
    return blocks.slice(0, index).filter(isFormField).filter(field => comparableInput(field.input) && (staff || !field.staffOnly));
}

// Marks a question staff-only (or back): organizers fill it, so it is never
// required or editable by the participant.
export function setStaffOnly(blocks: FormBlock[], index: number, staffOnly: boolean): FormBlock[] {
    const field = blocks[index];
    if (!field || !isFormField(field)) return blocks;
    const next: FormField = staffOnly
        ? {...field, staffOnly: true, required: false, editable: undefined, ...(field.input === "file" ? inputSettings("text") : {}), input: field.input === "file" ? "text" : field.input}
        : {...field, staffOnly: undefined};
    return replaceField(blocks, index, next);
}

export function initialConditionValue(source: FormField): string | number | boolean {
    if (source.input === "date") return "";
    if (source.input === "number") return 0;
    if (source.input === "checkbox") return true;
    if (source.input === "select") return source.options?.find(option => option.trim()) ?? "";
    return "";
}

// Condition for a block switched to «За умовою»: the nearest earlier question.
export function defaultCondition(blocks: FormBlock[], index: number): FormField["condition"] {
    const sources = conditionSources(blocks, index);
    const source = sources[sources.length - 1];
    return source ? {fieldKey: source.key, operator: "equals", value: initialConditionValue(source)} : undefined;
}

function mapDependents(blocks: FormBlock[], sourceKey: string, update: (condition: NonNullable<FormField["condition"]>) => FormField["condition"]): FormBlock[] {
    return blocks.map(block => isFormField(block) && block.condition?.fieldKey === sourceKey ? {...block, condition: update(block.condition)} : block);
}

function replaceField(blocks: FormBlock[], index: number, field: FormField): FormBlock[] {
    return blocks.map((block, position) => position === index ? field : block);
}

// Removing a question drops the conditions that pointed at it.
export function removeBlock(blocks: FormBlock[], index: number): FormBlock[] {
    const removed = blocks[index];
    const rest = blocks.filter((_, position) => position !== index);
    return removed && isFormField(removed) ? mapDependents(rest, removed.key, () => undefined) : rest;
}

// A new answer type makes old condition values meaningless, so the questions
// that depend on this one restart from the type's default value.
export function changeInput(blocks: FormBlock[], index: number, input: FormField["input"]): FormBlock[] {
    const field = blocks[index];
    if (!field || !isFormField(field) || field.input === input) return blocks;
    const next: FormField = {...field, input, ...inputSettings(input, field)};
    return mapDependents(replaceField(blocks, index, next), field.key, condition => comparableInput(input)
        ? {...condition, operator: conditionOperators(next).includes(condition.operator) ? condition.operator : "equals", value: initialConditionValue(next)}
        : undefined);
}

function setOptions(blocks: FormBlock[], index: number, options: string[], renamed?: {from: string; to: string}): FormBlock[] {
    const field = blocks[index];
    if (!field || !isFormField(field)) return blocks;
    const next: FormField = {...field, options};
    return mapDependents(replaceField(blocks, index, next), field.key, condition => {
        if (field.input !== "select") return condition;
        if (renamed && condition.value === renamed.from) return {...condition, value: renamed.to};
        return options.includes(String(condition.value)) ? condition : {...condition, value: initialConditionValue(next)};
    });
}

function optionsOf(blocks: FormBlock[], index: number): string[] {
    const field = blocks[index];
    return field && isFormField(field) ? field.options ?? [] : [];
}

export function addOption(blocks: FormBlock[], index: number): FormBlock[] {
    return setOptions(blocks, index, [...optionsOf(blocks, index), ""]);
}

// Renaming an option keeps the conditions that were set to it.
export function renameOption(blocks: FormBlock[], index: number, optionIndex: number, value: string): FormBlock[] {
    const options = optionsOf(blocks, index);
    const from = options[optionIndex];
    return setOptions(blocks, index, options.map((option, position) => position === optionIndex ? value : option), from ? {from, to: value} : undefined);
}

export function removeOption(blocks: FormBlock[], index: number, optionIndex: number): FormBlock[] {
    return setOptions(blocks, index, optionsOf(blocks, index).filter((_, position) => position !== optionIndex));
}

export function moveOption(blocks: FormBlock[], index: number, optionIndex: number, direction: -1 | 1): FormBlock[] {
    const options = [...optionsOf(blocks, index)];
    const target = optionIndex + direction;
    if (target < 0 || target >= options.length) return blocks;
    [options[optionIndex], options[target]] = [options[target], options[optionIndex]];
    return setOptions(blocks, index, options);
}

// Positions of the options that block saving: empty ones and repeats of an
// earlier option (compared without surrounding spaces).
export function invalidOptions(options: string[]): Set<number> {
    const seen = new Set<string>();
    const invalid = new Set<number>();
    options.forEach((option, position) => {
        const value = option.trim();
        if (!value || seen.has(value)) invalid.add(position);
        seen.add(value);
    });
    return invalid;
}

// A copy right below the block. A question gets its own key, so answers and
// conditions of the original stay with the original.
export function duplicateBlock(blocks: FormBlock[], index: number): {blocks: FormBlock[]; copy: FormBlock} | null {
    const block = blocks[index];
    if (!block) return null;
    const copy: FormBlock = isFormField(block)
        ? {...structuredClone(block), id: `field-${crypto.randomUUID()}`, key: `field_${crypto.randomUUID().replaceAll("-", "")}`}
        : {...structuredClone(block), id: `${block.type}-${crypto.randomUUID()}`};
    return {blocks: [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)], copy};
}

// The first problem of the form and the position of the block it is about.
export function participantFormProblem(document: FormDocument): {message: string; index: number} | null {
    const ids = new Set<string>();
    const keys = new Set<string>();
    const previous = new Map<string, FormField>();
    for (const [index, block] of document.blocks.entries()) {
        if (!block.id || ids.has(block.id)) return {index, message: t("manage.fields.validation.duplicateBlockID", {n: index + 1})};
        ids.add(block.id);
        if (!isFormField(block)) {
            if (block.type === "section" && !block.label?.trim()) return {index, message: t("manage.fields.validation.sectionTitle", {n: index + 1})};
            if (block.type === "text" && !richTextHasContent(block.richText)) return {index, message: t("manage.fields.validation.textContent", {n: index + 1})};
            continue;
        }
        if (!block.key.trim() || keys.has(block.key)) return {index, message: t("manage.fields.validation.key", {n: index + 1})};
        if (!block.label.trim()) return {index, message: t("manage.fields.validation.label", {n: index + 1})};
        if (isChoiceInput(block.input)) {
            const options = block.options ?? [];
            if (!options.length) return {index, message: t("manage.fields.validation.optionsMissing", {n: index + 1})};
            const emptyAt = options.findIndex(option => !option.trim());
            if (emptyAt >= 0) return {index, message: t("manage.fields.validation.optionEmpty", {n: index + 1, option: emptyAt + 1})};
            if (invalidOptions(options).size) return {index, message: t("manage.fields.validation.optionDuplicate", {n: index + 1})};
        }
        if (block.staffOnly && block.input === "file") return {index, message: t("manage.fields.validation.staffFile", {n: index + 1})};
        if (block.input === "file") {
            if (!block.fileTypes?.length) return {index, message: t("manage.fields.validation.fileTypes", {n: index + 1})};
            const size = block.maxSizeMB ?? defaultFileMB;
            if (!Number.isInteger(size) || size < 1 || size > maxFileMB) return {index, message: t("manage.fields.validation.fileSize", {n: index + 1, max: maxFileMB})};
        }
        if (block.input === "date") {
            if (block.dateMode === "none") return {index, message: t("manage.fields.validation.dateParts", {n: index + 1})};
            const mode = dateModeOf(block);
            const min = block.minDate ? parseDateAnswer(mode, block.minDate) : undefined;
            const max = block.maxDate ? parseDateAnswer(mode, block.maxDate) : undefined;
            if (min === null || max === null) return {index, message: t("manage.fields.validation.dateLimit", {n: index + 1})};
            if (min !== undefined && max !== undefined && max < min) return {index, message: t("manage.fields.validation.dateRange", {n: index + 1})};
        }
        if (block.condition) {
            const source = previous.get(block.condition.fieldKey);
            if (!source) return {index, message: t("manage.fields.validation.conditionSource", {n: index + 1})};
            if (!comparableInput(source.input)) return {index, message: t("manage.fields.validation.conditionSingle", {n: index + 1})};
            if (source.staffOnly && !block.staffOnly) return {index, message: t("manage.fields.validation.conditionStaff", {n: index + 1})};
            const value = block.condition.value;
            if (!conditionOperators(source).includes(block.condition.operator)) return {index, message: t("manage.fields.validation.conditionOperator", {n: index + 1})};
            if (source.input === "date" && parseDateAnswer(dateModeOf(source), value) === null) return {index, message: t("manage.fields.validation.conditionDate", {n: index + 1})};
            if (source.input === "number" && (typeof value !== "number" || !Number.isFinite(value))) return {index, message: t("manage.fields.validation.conditionNumber", {n: index + 1})};
            if (source.input === "checkbox" && typeof value !== "boolean") return {index, message: t("manage.fields.validation.conditionValue", {n: index + 1})};
            if (source.input === "select" && !source.options?.includes(String(value))) return {index, message: t("manage.fields.validation.conditionOption", {n: index + 1})};
            if ((source.input === "text" || source.input === "long_text") && (typeof value !== "string" || !value.trim())) return {index, message: t("manage.fields.validation.conditionValue", {n: index + 1})};
        }
        keys.add(block.key);
        previous.set(block.key, block);
    }
    return null;
}

export function validateParticipantForm(document: FormDocument): string | null {
    return participantFormProblem(document)?.message ?? null;
}
