import type {FormBlock, FormDocument, FormField} from "@/api/manageParticipantForm";
import {richTextHasContent} from "../content/richTextState";
import {t} from "@/i18n/t";

export function isFormField(block: FormBlock): block is FormField { return block.type === "field"; }

export function createFormField(input: FormField["input"] = "text"): FormField {
    return {id: `field-${crypto.randomUUID()}`, type: "field", key: `field_${crypto.randomUUID().replaceAll("-", "")}`, input, label: "", required: false, options: input === "select" || input === "multi_select" ? [""] : undefined};
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
        if ((block.input === "select" || block.input === "multi_select") && (!block.options?.length || block.options.some(option => !option.trim()) || new Set(block.options.map(option => option.trim())).size !== block.options.length)) return t("manage.fields.validation.options", {n: index + 1});
        if (block.condition) {
            const source = previous.get(block.condition.fieldKey);
            if (!source) return t("manage.fields.validation.conditionSource", {n: index + 1});
            if (source.input === "multi_select") return t("manage.fields.validation.conditionSingle", {n: index + 1});
            if (source.input === "number" && typeof block.condition.value !== "number") return t("manage.fields.validation.conditionNumber", {n: index + 1});
            if (source.input === "checkbox" && typeof block.condition.value !== "boolean") return t("manage.fields.validation.conditionValue", {n: index + 1});
            if (source.input === "select" && !source.options?.includes(String(block.condition.value))) return t("manage.fields.validation.conditionOption", {n: index + 1});
        }
        keys.add(block.key);
        previous.set(block.key, block);
    }
    return null;
}
