import type {FormBlock, FormDocument, FormField} from "@/api/manageParticipantForm";
import {richTextHasContent} from "../content/richTextState";
import {t} from "@/i18n/t";

export function isFormField(block: FormBlock): block is FormField { return block.type === "field"; }

export function isChoiceInput(input: FormField["input"]): boolean { return input === "select" || input === "multi_select"; }

export function createFormField(input: FormField["input"] = "text"): FormField {
    return {id: `field-${crypto.randomUUID()}`, type: "field", key: `field_${crypto.randomUUID().replaceAll("-", "")}`, input, label: "", required: false, options: isChoiceInput(input) ? [""] : undefined};
}

// A condition may depend only on an earlier single-answer question.
export function conditionSources(blocks: FormBlock[], index: number): FormField[] {
    return blocks.slice(0, index).filter(isFormField).filter(field => field.input !== "multi_select");
}

export function initialConditionValue(source: FormField): string | number | boolean {
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
    const next: FormField = {...field, input, options: isChoiceInput(input) ? field.options?.length ? field.options : [""] : undefined};
    return mapDependents(replaceField(blocks, index, next), field.key, condition => input === "multi_select" ? undefined : {...condition, value: initialConditionValue(next)});
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

export function validateParticipantForm(document: FormDocument): string | null {
    const ids = new Set<string>();
    const keys = new Set<string>();
    const previous = new Map<string, FormField>();
    for (const [index, block] of document.blocks.entries()) {
        if (!block.id || ids.has(block.id)) return t("manage.fields.validation.duplicateBlockID", {n: index + 1});
        ids.add(block.id);
        if (!isFormField(block)) {
            if (block.type === "section" && !block.label?.trim()) return t("manage.fields.validation.sectionTitle", {n: index + 1});
            if (block.type === "text" && !richTextHasContent(block.richText)) return t("manage.fields.validation.textContent", {n: index + 1});
            continue;
        }
        if (!block.key.trim() || keys.has(block.key)) return t("manage.fields.validation.key", {n: index + 1});
        if (!block.label.trim()) return t("manage.fields.validation.label", {n: index + 1});
        if (isChoiceInput(block.input)) {
            const options = block.options ?? [];
            if (!options.length) return t("manage.fields.validation.optionsMissing", {n: index + 1});
            const emptyAt = options.findIndex(option => !option.trim());
            if (emptyAt >= 0) return t("manage.fields.validation.optionEmpty", {n: index + 1, option: emptyAt + 1});
            if (invalidOptions(options).size) return t("manage.fields.validation.optionDuplicate", {n: index + 1});
        }
        if (block.condition) {
            const source = previous.get(block.condition.fieldKey);
            if (!source) return t("manage.fields.validation.conditionSource", {n: index + 1});
            if (source.input === "multi_select") return t("manage.fields.validation.conditionSingle", {n: index + 1});
            const value = block.condition.value;
            if (source.input === "number" && (typeof value !== "number" || !Number.isFinite(value))) return t("manage.fields.validation.conditionNumber", {n: index + 1});
            if (source.input === "checkbox" && typeof value !== "boolean") return t("manage.fields.validation.conditionValue", {n: index + 1});
            if (source.input === "select" && !source.options?.includes(String(value))) return t("manage.fields.validation.conditionOption", {n: index + 1});
            if ((source.input === "text" || source.input === "long_text") && (typeof value !== "string" || !value.trim())) return t("manage.fields.validation.conditionValue", {n: index + 1});
        }
        keys.add(block.key);
        previous.set(block.key, block);
    }
    return null;
}
