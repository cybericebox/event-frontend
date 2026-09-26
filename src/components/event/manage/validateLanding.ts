import type {ContentDocument} from "@/types/eventContent";
import {visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";

const tokenPattern = /\{\{([a-z][a-zA-Z0-9.]*)\}\}/g;

export function validateLanding(document: ContentDocument, catalog: ContentVariableDefinition[]): string | null {
    const contentVariableByName = new Map(catalog.map(variable => [variable.name, variable]));
    const ids = new Set<string>();
    for (const [index, block] of document.blocks.entries()) {
        if (!block.id.trim() || ids.has(block.id)) return `Блок ${index + 1}: некоректний або повторний ідентифікатор.`;
        ids.add(block.id);
        const text = block.type === "section" ? block.label ?? "" : block.type === "text" ? block.markdown ?? "" : "";
        if ((block.type === "section" || block.type === "text") && !text.trim()) return `Блок ${index + 1}: заповніть ${block.type === "section" ? "назву" : "текст"}.`;
        if (block.markdown?.includes("<")) return `Блок ${index + 1}: HTML у тексті не підтримується.`;
        if (["facts", "timeline", "faq"].includes(block.type) && (!block.items?.length || block.items.some(item => !item.label?.trim() || !item.value?.trim()))) return `Блок ${index + 1}: заповніть усі пункти або видаліть порожні.`;
        if (block.type === "faq" && block.openItem !== undefined && (block.openItem < 0 || block.openItem >= (block.items?.length ?? 0))) return `Блок ${index + 1}: оберіть питання, яке відкрити.`;
        if (block.type === "doc" && (!block.items?.length || block.items.some(item => !item.label?.trim() || !item.value?.trim() || item.value.includes("<")))) return `Блок ${index + 1}: додайте розділ із назвою та безпечним текстом.`;
        if (block.type === "cta" && (!block.title?.trim() || !block.action?.label.trim() || !block.action?.href.trim())) return `Блок ${index + 1}: додайте заголовок і кнопку.`;
        if (block.type === "cta" && block.action && !/^(\/(?!\/)|#|https:\/\/)/.test(block.action.href)) return `Блок ${index + 1}: посилання має бути внутрішнім або HTTPS.`;
        if (block.type === "cta" && block.variant && !["plain", "mass"].includes(block.variant)) return `Блок ${index + 1}: невідоме оформлення дії.`;
        if (block.type === "cta" && block.secondaryAction && (!block.secondaryAction.label.trim() || !/^(\/(?!\/)|#|https:\/\/)/.test(block.secondaryAction.href))) return `Блок ${index + 1}: заповніть другу дію та її посилання.`;
        if (block.type === "facts" && block.variant && !["strip", "rows"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка фактів.`;
        if (block.type === "hero") {
            if (index !== 0) return `Блок ${index + 1}: герой має бути першим блоком.`;
            if (!block.title?.trim()) return `Блок ${index + 1}: вкажіть назву героя.`;
            if (block.variant && !["mass", "plain"].includes(block.variant)) return `Блок ${index + 1}: невідоме оформлення героя.`;
            if ((block.items?.length ?? 0) > 4 || block.items?.some(item => !item.label?.trim() || !item.value?.trim())) return `Блок ${index + 1}: заповніть факти героя, не більше чотирьох.`;
            for (const action of [block.action, block.secondaryAction]) {
                if (action && (!action.label.trim() || !/^(\/(?!\/)|#|https:\/\/)/.test(action.href))) return `Блок ${index + 1}: заповніть текст і посилання дії.`;
            }
            if (block.targetVariable && !catalog.some(item => item.name === block.targetVariable && item.format === "date-time")) return `Блок ${index + 1}: оберіть доступну змінну дати.`;
        }
        if (block.type === "countdown" && (!block.targetVariable || !catalog.some(item => item.name === block.targetVariable && item.format === "date-time"))) return `Блок ${index + 1}: оберіть доступну змінну дати.`;
        const bindings = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
        for (const variable of block.variables ?? []) {
            if (contentVariableByName.get(variable.name)?.format !== variable.format) return `Блок ${index + 1}: змінна ${variable.name} недоступна для цієї сторінки.`;
        }
        if ((block.type === "countdown" || (block.type === "hero" && block.targetVariable)) && !bindings.has(block.targetVariable ?? "")) return `Блок ${index + 1}: змінну дати потрібно додати до блока.`;
        const fields = [text, block.title ?? "", block.sub ?? "", block.text ?? "", block.by ?? "", block.kicker ?? "", block.note ?? "", block.tocTitle ?? "", block.action?.label ?? "", block.secondaryAction?.label ?? "", ...(block.items ?? []).flatMap(item => [item.label ?? "", item.value ?? ""])];
        for (const field of fields) {
            for (const [, variable] of field.matchAll(tokenPattern)) {
                if (!bindings.has(variable)) return `Блок ${index + 1}: змінну ${variable} потрібно додати через список.`;
            }
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
