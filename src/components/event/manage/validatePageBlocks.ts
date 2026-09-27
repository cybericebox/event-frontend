import type {ContentBlock, ContentDocument} from "@/types/eventContent";
import {visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {validDatePattern} from "@/components/event/content/dateDisplay";

const tokenPattern = /\{\{([a-z][a-zA-Z0-9.]*)\}\}/g;

export function blockValidationIndex(error: string | null): number | null {
    const match = /^Блок (\d+): /.exec(error ?? "");
    return match ? Number(match[1]) - 1 : null;
}

export function blockValidationField(error: string | undefined, block: ContentBlock): string | null {
    const message = error?.replace(/^Блок \d+: /, "") ?? "";
    if (message === "вкажіть коректний формат дати.") {
        const field = Object.entries(block.dateDisplays ?? {}).find(([, formats]) => Object.values(formats).some(display => display.format === "custom" && !validDatePattern(display.pattern ?? "")))?.[0];
        return field ? `dateDisplays:${field}` : null;
    }
    if (message === "заповніть назву.") return "label";
    if (message === "заповніть текст.") return "markdown";
    if (message === "вкажіть назву героя.") return "title";
    if (message === "додайте заголовок і кнопку.") return !block.title?.trim() ? "title" : !block.action?.label.trim() ? "action:label" : "action:href";
    if (message === "посилання має бути внутрішнім або HTTPS.") return "action:href";
    if (message === "заповніть другу дію та її посилання.") return !block.secondaryAction?.label.trim() ? "secondaryAction:label" : "secondaryAction:href";
    if (message === "заповніть текст і посилання дії.") return !block.action?.label.trim() ? "action:label" : "action:href";
    if (message === "заповніть кнопку відліку та її посилання.") return !block.action?.label.trim() ? "action:label" : "action:href";
    if (message === "прикріпіть окреме зображення банера.") return "imageURL";
    if (message.startsWith("обкладинку події не завантажено.")) return "imageSource";
    if (message === "вкажіть свою дату й час відліку." || message === "вкажіть коректну дату й час.") return "targetDate";
    if (message === "оберіть дату події для відліку." || message === "оберіть дату події або задайте її вручну." || message === "оберіть доступну змінну дати.") return "targetVariable";
    if (message === "заповніть усі пункти або видаліть порожні." || message === "додайте розділ із назвою та безпечним текстом." || message === "заповніть факти героя, не більше чотирьох.") {
        const itemIndex = block.items?.findIndex(item => !item.label?.trim() || !item.value?.trim()) ?? -1;
        if (itemIndex >= 0) return `item:${itemIndex}:${block.items?.[itemIndex].label?.trim() ? "value" : "label"}`;
    }
    if (block.type === "timeline" && message.startsWith("етап розкладу:")) {
        const index = block.items?.findIndex(item => {
            if (message.includes("назву події")) return !item.value?.trim();
            if (message.includes("свою дату")) return item.dateSource === "custom" && (!item.dateValue || Number.isNaN(Date.parse(item.dateValue)));
            if (message.includes("формат")) return item.dateFormat === "custom" && !validDatePattern(item.datePattern ?? "");
            return item.dateSource !== "custom" && !item.dateVariable;
        }) ?? -1;
        const itemIndex = index < 0 ? 0 : index;
        if (message.includes("назву події")) return `item:${itemIndex}:value`;
        if (message.includes("свою дату")) return `item:${itemIndex}:dateValue`;
        if (message.includes("формат")) return `item:${itemIndex}:datePattern`;
        return `item:${itemIndex}:dateVariable`;
    }
    if (block.type === "timeline" && message === "у назві події не можна використовувати змінну дати.") {
        const index = block.items?.findIndex(item => [...(item.value ?? "").matchAll(tokenPattern)].some(([, name]) => block.variables?.some(binding => binding.name === name && binding.format === "date-time"))) ?? -1;
        return index >= 0 ? `item:${index}:value` : null;
    }
    return null;
}

function validHref(href: string): boolean {
    const value = href.trim();
    if (!value || /[\\\r\n\t]/.test(value) || value.startsWith("//")) return false;
    if (value.startsWith("/") || value.startsWith("#")) return true;
    try {const url = new URL(value); return url.protocol === "https:" && !!url.host && !url.username && !url.password;} catch {return false;}
}

export function validateLanding(document: ContentDocument, catalog: ContentVariableDefinition[], coverImage = ""): string | null {
    const contentVariableByName = new Map(catalog.map(variable => [variable.name, variable]));
    const ids = new Set<string>();
    for (const [index, block] of document.blocks.entries()) {
        if (!block.id.trim() || ids.has(block.id)) return `Блок ${index + 1}: некоректний або повторний ідентифікатор.`;
        ids.add(block.id);
        const text = block.type === "section" ? block.label ?? "" : block.type === "text" ? block.markdown ?? "" : "";
        if ((block.type === "section" || block.type === "text") && !text.trim()) return `Блок ${index + 1}: заповніть ${block.type === "section" ? "назву" : "текст"}.`;
        if (block.markdown?.includes("<")) return `Блок ${index + 1}: HTML у тексті не підтримується.`;
        if (block.type === "section" && block.variant && !["left", "center", "right", "justify"].includes(block.variant)) return `Блок ${index + 1}: невідоме вирівнювання заголовка.`;
        if (block.type === "text" && block.variant && !["narrow", "wide"].includes(block.variant)) return `Блок ${index + 1}: невідома ширина тексту.`;
        if (block.type === "text" && block.layout && !["left", "center", "right", "justify"].includes(block.layout)) return `Блок ${index + 1}: невідоме вирівнювання тексту.`;
        if (block.type === "timeline" && block.variant && !["grid", "list"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка розкладу.`;
        if (block.type === "banner" && block.variant && !["edge", "frame"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка банера.`;
        if (block.type === "banner" && block.layout && !["left", "center", "right"].includes(block.layout)) return `Блок ${index + 1}: невідоме розташування підпису банера.`;
        if (block.type === "banner" && block.widthPercent !== undefined && (block.widthPercent < 50 || block.widthPercent > 100 || block.widthPercent % 5 !== 0)) return `Блок ${index + 1}: ширина банера має бути від 50% до 100% із кроком 5%.`;
        if (block.type === "banner" && block.imageSource === "custom" && !block.imageURL?.trim()) return `Блок ${index + 1}: прикріпіть окреме зображення банера.`;
        if (block.type === "banner" && block.imageSource !== "custom" && !coverImage) return `Блок ${index + 1}: обкладинку події не завантажено. Прикріпіть окреме зображення банера.`;
        if (["facts", "faq"].includes(block.type) && (!block.items?.length || block.items.some(item => !item.label?.trim() || !item.value?.trim()))) return `Блок ${index + 1}: заповніть усі пункти або видаліть порожні.`;
        if (block.type === "timeline") {
            if (!block.items?.length) return `Блок ${index + 1}: додайте етап розкладу.`;
            for (const item of block.items) {
                if (!item.value?.trim()) return `Блок ${index + 1}: етап розкладу: вкажіть назву події.`;
                if ([...item.value.matchAll(tokenPattern)].some(([, name]) => catalog.some(variable => variable.name === name && variable.format === "date-time"))) return `Блок ${index + 1}: у назві події не можна використовувати змінну дати.`;
                if (item.dateSource === "custom") {
                    if (!item.dateValue || Number.isNaN(Date.parse(item.dateValue))) return `Блок ${index + 1}: етап розкладу: вкажіть свою дату й час.`;
                } else if (item.dateSource !== "event" || !!item.dateValue || !catalog.some(variable => variable.name === item.dateVariable && variable.format === "date-time") || !block.variables?.some(binding => binding.name === item.dateVariable && binding.format === "date-time")) return `Блок ${index + 1}: етап розкладу: оберіть дату події.`;
                if (item.dateFormat === "custom" && !validDatePattern(item.datePattern ?? "")) return `Блок ${index + 1}: етап розкладу: вкажіть коректний формат дати.`;
            }
        }
        if (block.type === "faq" && block.openItem !== undefined && (block.openItem < 0 || block.openItem >= (block.items?.length ?? 0))) return `Блок ${index + 1}: оберіть питання, яке відкрити.`;
        if (block.type === "doc" && (!block.items?.length || block.items.some(item => !item.label?.trim() || !item.value?.trim() || item.value.includes("<")))) return `Блок ${index + 1}: додайте розділ із назвою та безпечним текстом.`;
        if (block.type === "cta" && (!block.title?.trim() || !block.action?.label.trim() || !block.action?.href.trim())) return `Блок ${index + 1}: додайте заголовок і кнопку.`;
        if (block.type === "cta" && block.action && !validHref(block.action.href)) return `Блок ${index + 1}: посилання має бути внутрішнім або HTTPS.`;
        if (block.type === "cta" && block.variant && !["plain", "mass"].includes(block.variant)) return `Блок ${index + 1}: невідоме оформлення дії.`;
        if (block.type === "cta" && block.secondaryAction && (!block.secondaryAction.label.trim() || !validHref(block.secondaryAction.href))) return `Блок ${index + 1}: заповніть другу дію та її посилання.`;
        if (block.type === "facts" && block.variant && !["strip", "rows"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка фактів.`;
        if (block.type === "hero") {
            if (!block.title?.trim()) return `Блок ${index + 1}: вкажіть назву героя.`;
            if (block.variant && !["mass", "plain"].includes(block.variant)) return `Блок ${index + 1}: невідоме оформлення героя.`;
            if (block.layout && !["split", "center"].includes(block.layout)) return `Блок ${index + 1}: невідоме розташування героя.`;
            if (block.timerSize && !["large", "xl"].includes(block.timerSize)) return `Блок ${index + 1}: невідомий розмір відліку героя.`;
            if ((block.items?.length ?? 0) > 4 || block.items?.some(item => !item.label?.trim() || !item.value?.trim())) return `Блок ${index + 1}: заповніть факти героя, не більше чотирьох.`;
            for (const action of [block.action, block.secondaryAction]) {
                if (action && (!action.label.trim() || !validHref(action.href))) return `Блок ${index + 1}: заповніть текст і посилання дії.`;
            }
            if (block.targetVariable && !catalog.some(item => item.name === block.targetVariable && item.format === "date-time")) return `Блок ${index + 1}: оберіть доступну змінну дати.`;
        }
        if ((block.type === "hero" || block.type === "countdown") && block.targetVariable && block.targetDate) return `Блок ${index + 1}: оберіть лише одне джерело дати.`;
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource && !["none", "event", "custom"].includes(block.dateSource)) return `Блок ${index + 1}: невідоме джерело дати відліку.`;
        if ((block.type === "hero" || block.type === "countdown") && block.timerDisplay && !["segments", "compact", "tiles"].includes(block.timerDisplay)) return `Блок ${index + 1}: невідомий вигляд лічильника.`;
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "none" && (block.type === "countdown" || block.targetVariable || block.targetDate)) return `Блок ${index + 1}: джерело дати відліку не відповідає налаштуванням.`;
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "event" && block.targetDate) return `Блок ${index + 1}: джерело дати відліку не відповідає налаштуванням.`;
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "custom" && block.targetVariable) return `Блок ${index + 1}: джерело дати відліку не відповідає налаштуванням.`;
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "custom" && !block.targetDate) return `Блок ${index + 1}: вкажіть свою дату й час відліку.`;
        if (block.type === "countdown" && block.dateSource === "event" && !block.targetVariable) return `Блок ${index + 1}: оберіть дату події для відліку.`;
        if ((block.type === "hero" || block.type === "countdown") && block.targetDate && (Number.isNaN(Date.parse(block.targetDate)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(block.targetDate))) return `Блок ${index + 1}: вкажіть коректну дату й час.`;
        if (block.type === "countdown" && !block.targetDate && (!block.targetVariable || !catalog.some(item => item.name === block.targetVariable && item.format === "date-time"))) return `Блок ${index + 1}: оберіть дату події або задайте її вручну.`;
        if (block.type === "countdown" && block.variant && !["split", "center"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка відліку.`;
        if (block.type === "countdown" && block.verticalAlignment && !["start", "center", "end"].includes(block.verticalAlignment)) return `Блок ${index + 1}: невідоме положення тексту відліку.`;
        if (block.type === "countdown" && block.timerSize && !["large", "xl"].includes(block.timerSize)) return `Блок ${index + 1}: невідомий розмір відліку.`;
        if (block.type === "countdown" && block.surface && !["plain", "frame"].includes(block.surface)) return `Блок ${index + 1}: невідоме оформлення відліку.`;
        if (block.type === "countdown" && block.action && (!block.action.label.trim() || !validHref(block.action.href))) return `Блок ${index + 1}: заповніть кнопку відліку та її посилання.`;
        const bindings = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
        for (const variable of block.variables ?? []) {
            if (contentVariableByName.get(variable.name)?.format !== variable.format) return `Блок ${index + 1}: змінна ${variable.name} недоступна для цієї сторінки.`;
        }
        for (const displays of Object.values(block.dateDisplays ?? {})) {
            for (const display of Object.values(displays)) {
                if (display.format === "custom" && !validDatePattern(display.pattern ?? "")) return `Блок ${index + 1}: вкажіть коректний формат дати.`;
            }
        }
        if ((block.type === "hero" || block.type === "countdown") && block.targetVariable && !bindings.has(block.targetVariable)) return `Блок ${index + 1}: змінну дати потрібно додати до блока.`;
        const fields = [text, block.title ?? "", block.sub ?? "", block.text ?? "", block.by ?? "", block.kicker ?? "", block.note ?? "", block.tocTitle ?? "", block.action?.label ?? "", block.action?.href ?? "", block.secondaryAction?.label ?? "", block.secondaryAction?.href ?? "", ...(block.items ?? []).flatMap(item => [item.label ?? "", item.value ?? ""])];
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
