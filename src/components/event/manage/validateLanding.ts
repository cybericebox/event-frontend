import type {ContentDocument} from "@/types/eventContent";
import {visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";

const tokenPattern = /\{\{([a-z][a-zA-Z0-9.]*)\}\}/g;

export function validateLanding(document: ContentDocument, catalog: ContentVariableDefinition[]): string | null {
    const contentVariableByName = new Map(catalog.map(variable => [variable.name, variable]));
    const ids = new Set<string>();
    for (const [index, block] of document.blocks.entries()) {
        if (!block.id.trim() || ids.has(block.id)) return `Блок ${index + 1}: некоректний або повторний ідентифікатор.`;
        ids.add(block.id);
        const text = block.type === "section" ? block.label ?? "" : block.markdown ?? "";
        if (!text.trim()) return `Блок ${index + 1}: заповніть ${block.type === "section" ? "назву" : "текст"}.`;
        if (block.markdown?.includes("<")) return `Блок ${index + 1}: HTML у тексті не підтримується.`;
        const bindings = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
        for (const variable of block.variables ?? []) {
            if (contentVariableByName.get(variable.name)?.format !== variable.format) return `Блок ${index + 1}: змінна ${variable.name} недоступна для цієї сторінки.`;
        }
        for (const [, variable] of text.matchAll(tokenPattern)) {
            if (!bindings.has(variable)) return `Блок ${index + 1}: змінну ${variable} потрібно додати через список.`;
        }
        for (const rule of block.visibility ?? []) {
            const format = bindings.get(rule.variable);
            if (!format) return `Блок ${index + 1}: змінна умови не додана до блоку.`;
            const definition = contentVariableByName.get(rule.variable);
            if (definition && !visibilityOperators(definition.format).some(operator => operator.value === rule.operator)) return `Блок ${index + 1}: некоректна умова показу.`;
            if (format === "number" && (typeof rule.value !== "number" || !Number.isFinite(rule.value))) return `Блок ${index + 1}: введіть число в умові.`;
            if (format === "boolean" && typeof rule.value !== "boolean") return `Блок ${index + 1}: оберіть значення умови.`;
            if (format === "text" && typeof rule.value !== "string") return `Блок ${index + 1}: введіть текст умови.`;
            if (format === "date-time" && (typeof rule.value !== "string" || Number.isNaN(Date.parse(rule.value)))) return `Блок ${index + 1}: вкажіть дату й час умови.`;
        }
    }
    return null;
}
