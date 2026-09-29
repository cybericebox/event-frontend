import type {ContentBlock, ContentDocument} from "../../../types/eventContent";
import {visibilityOperators, type ContentVariableDefinition} from "../content/variableCatalog";
import {validDatePattern} from "../content/dateDisplay";
import {richTextHasContent, richTextVariableNames} from "../content/richTextState";
import {anchorError} from "./blockAnchor";

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
    if (message.startsWith("якір:")) return "anchor";
    if (message.startsWith("партнери:")) return "groups";
    if (message === "заповніть назву.") return "label";
    if (message === "заповніть текст.") return "richText";
    if (message === "вкажіть назву героя.") return "title";
    if (message === "вкажіть текст кнопки.") return "action:label";
    if (message === "вкажіть посилання кнопки." || message === "посилання кнопки має бути внутрішнім або HTTPS.") return "action:href";
    if (message === "вкажіть текст кнопки відліку.") return "action:label";
    if (message === "вкажіть посилання кнопки відліку." || message === "посилання кнопки відліку має бути внутрішнім або HTTPS.") return "action:href";
    if (message === "вкажіть текст головної дії.") return "action:label";
    if (message === "вкажіть посилання головної дії." || message === "посилання головної дії має бути внутрішнім або HTTPS.") return "action:href";
    if (message === "вкажіть текст другої дії.") return "secondaryAction:label";
    if (message === "вкажіть посилання другої дії." || message === "посилання другої дії має бути внутрішнім або HTTPS.") return "secondaryAction:href";
    if (message === "прикріпіть окреме зображення банера.") return "imageURL";
    if (message.startsWith("обкладинку події не завантажено.")) return "imageSource";
    if (message === "вкажіть свою дату й час відліку." || message === "вкажіть коректну дату й час.") return "targetDate";
    if (message === "оберіть дату початку показу.") return "showFromVariable";
    if (message === "вкажіть коректну дату початку показу." || message === "початок показу має бути раніше завершення відліку.") return "showFromDate";
    if (message === "оберіть дату події для відліку." || message === "оберіть дату події або задайте її вручну." || message === "оберіть доступну змінну дати.") return "targetVariable";
    if (message === "заповніть усі пункти або видаліть порожні." || message === "додайте розділ із назвою та безпечним текстом." || message === "заповніть факти героя, не більше чотирьох.") {
        const itemIndex = block.items?.findIndex(item => !item.label?.trim() || (block.type === "faq" || block.type === "doc" ? !richTextHasContent(item.richText) : !item.value?.trim())) ?? -1;
        if (itemIndex >= 0) return `item:${itemIndex}:${block.items?.[itemIndex].label?.trim() ? block.type === "faq" || block.type === "doc" ? "richText" : "value" : "label"}`;
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
        // A repeated anchor is reported at its later block.
        const anchorProblem = anchorError(block.anchor ?? "", [...document.blocks.filter(other => other.id !== block.id).map(other => other.id), ...document.blocks.slice(0, index).map(other => other.anchor ?? "")]);
        if (anchorProblem) return `Блок ${index + 1}: якір: ${anchorProblem.replace(/^./, first => first.toLocaleLowerCase("uk"))}`;
        if (block.type === "partners") {
            const groups = block.groups ?? [];
            if (!groups.length || groups.length > 10) return `Блок ${index + 1}: партнери: додайте від однієї до десяти груп.`;
            for (const group of groups) {
                if (!group.items.length || group.items.length > 24) return `Блок ${index + 1}: партнери: додайте логотип у кожну групу (до 24) або видаліть порожню.`;
                if ([group.title ?? "", ...group.items.flatMap(logo => [logo.name, logo.href ?? ""])].some(text => /\{\{/.test(text))) return `Блок ${index + 1}: партнери: змінні в назвах і посиланнях не підтримуються.`;
                for (const logo of group.items) {
                    if (!logo.name.trim()) return `Блок ${index + 1}: партнери: вкажіть назву кожного партнера.`;
                    if (!logo.imageURL.trim()) return `Блок ${index + 1}: партнери: прикріпіть файл логотипа.`;
                    if (logo.href && !validHref(logo.href)) return `Блок ${index + 1}: партнери: посилання має бути внутрішнім або HTTPS.`;
                }
            }
        }
        const text = block.type === "section" ? block.label ?? "" : "";
        if (block.type === "section" && !text.trim()) return `Блок ${index + 1}: заповніть назву.`;
        if (block.type === "text" && !richTextHasContent(block.richText)) return `Блок ${index + 1}: заповніть текст.`;
        if (block.type === "section" && block.variant && !["left", "center", "right", "justify"].includes(block.variant)) return `Блок ${index + 1}: невідоме вирівнювання заголовка.`;
        if (block.type === "text" && block.variant && !["narrow", "wide"].includes(block.variant)) return `Блок ${index + 1}: невідома ширина тексту.`;
        if (block.type === "text" && block.layout) return `Блок ${index + 1}: вирівнювання задається в самому тексті.`;
        if (block.type === "timeline" && block.variant && !["grid", "list"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка розкладу.`;
        if (block.type === "banner" && block.variant && !["edge", "frame"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка банера.`;
        if (block.type === "banner" && block.layout && !["left", "center", "right"].includes(block.layout)) return `Блок ${index + 1}: невідоме розташування підпису банера.`;
        if (block.type === "banner" && block.widthPercent !== undefined && (block.widthPercent < 50 || block.widthPercent > 100 || block.widthPercent % 5 !== 0)) return `Блок ${index + 1}: ширина банера має бути від 50% до 100% із кроком 5%.`;
        if (block.type === "banner" && block.imageSource === "custom" && !block.imageURL?.trim()) return `Блок ${index + 1}: прикріпіть окреме зображення банера.`;
        if (block.type === "banner" && block.imageSource !== "custom" && !coverImage) return `Блок ${index + 1}: обкладинку події не завантажено. Прикріпіть окреме зображення банера.`;
        if (["facts", "faq"].includes(block.type) && (!block.items?.length || block.items.some(item => !item.label?.trim() || (block.type === "faq" ? !richTextHasContent(item.richText) : !item.value?.trim())))) return `Блок ${index + 1}: заповніть усі пункти або видаліть порожні.`;
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
        if (block.type === "doc" && (!block.items?.length || block.items.some(item => !item.label?.trim() || !richTextHasContent(item.richText)))) return `Блок ${index + 1}: додайте розділ із назвою та безпечним текстом.`;
        if (block.type === "cta" && !block.action?.label.trim()) return `Блок ${index + 1}: вкажіть текст кнопки.`;
        if (block.type === "cta" && block.action?.kind !== "join_event" && !block.action?.href?.trim()) return `Блок ${index + 1}: вкажіть посилання кнопки.`;
        if (block.type === "cta" && block.action?.kind !== "join_event" && block.action && !validHref(block.action.href ?? "")) return `Блок ${index + 1}: посилання кнопки має бути внутрішнім або HTTPS.`;
        if (block.type === "cta" && block.action?.kind === "join_event" && block.action.href?.trim()) return `Блок ${index + 1}: для реєстрації посилання не потрібне.`;
        if (block.type === "cta" && block.variant && !["plain", "mass"].includes(block.variant)) return `Блок ${index + 1}: невідоме оформлення дії.`;
        if (block.type === "cta" && block.secondaryAction && !block.secondaryAction.label.trim()) return `Блок ${index + 1}: вкажіть текст другої дії.`;
        if (block.type === "cta" && block.secondaryAction?.kind !== "join_event" && block.secondaryAction && !block.secondaryAction.href?.trim()) return `Блок ${index + 1}: вкажіть посилання другої дії.`;
        if (block.type === "cta" && block.secondaryAction?.kind !== "join_event" && block.secondaryAction && !validHref(block.secondaryAction.href ?? "")) return `Блок ${index + 1}: посилання другої дії має бути внутрішнім або HTTPS.`;
        if (block.type === "cta" && block.secondaryAction?.kind === "join_event" && block.secondaryAction.href?.trim()) return `Блок ${index + 1}: для реєстрації посилання не потрібне.`;
        if (block.type === "facts" && block.variant && !["strip", "rows"].includes(block.variant)) return `Блок ${index + 1}: невідома розкладка фактів.`;
        if (block.type === "hero") {
            if (!block.title?.trim()) return `Блок ${index + 1}: вкажіть назву героя.`;
            if (block.variant && !["mass", "plain"].includes(block.variant)) return `Блок ${index + 1}: невідоме оформлення героя.`;
            if (block.layout && !["split", "center"].includes(block.layout)) return `Блок ${index + 1}: невідоме розташування героя.`;
            if (block.timerSize && !["large", "xl"].includes(block.timerSize)) return `Блок ${index + 1}: невідомий розмір відліку героя.`;
            if ((block.items?.length ?? 0) > 4 || block.items?.some(item => !item.label?.trim() || !item.value?.trim())) return `Блок ${index + 1}: заповніть факти героя, не більше чотирьох.`;
            if (block.targetVariable && !catalog.some(item => item.name === block.targetVariable && item.format === "date-time")) return `Блок ${index + 1}: оберіть доступну змінну дати.`;
        }
        if ((block.type === "hero" || block.type === "countdown") && block.targetVariable && block.targetDate) return `Блок ${index + 1}: оберіть лише одне джерело дати.`;
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource && !["none", "event", "custom"].includes(block.dateSource)) return `Блок ${index + 1}: невідоме джерело дати відліку.`;
        if ((block.type === "hero" || block.type === "countdown") && block.timerDisplay && !["segments", "compact", "tiles", "focus", "dial", "ledger", "poster", "tracks", "flip", "ticker", "stairs", "orbits", "matrix", "ribbon", "rings"].includes(block.timerDisplay)) return `Блок ${index + 1}: невідомий вигляд лічильника.`;
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
        if (block.type === "countdown" && block.showFromSource && !["none", "event", "custom"].includes(block.showFromSource)) return `Блок ${index + 1}: невідомий початок показу.`;
        if (block.type === "countdown" && (!block.showFromSource || block.showFromSource === "none") && (block.showFromDate || block.showFromVariable)) return `Блок ${index + 1}: початок показу не відповідає джерелу.`;
        if (block.type === "countdown" && block.showFromSource === "event" && (!block.showFromVariable || !!block.showFromDate || !catalog.some(item => item.name === block.showFromVariable && item.format === "date-time") || !block.variables?.some(binding => binding.name === block.showFromVariable))) return `Блок ${index + 1}: оберіть дату початку показу.`;
        if (block.type === "countdown" && block.showFromSource === "custom" && (block.showFromVariable || !block.showFromDate || Number.isNaN(Date.parse(block.showFromDate)))) return `Блок ${index + 1}: вкажіть коректну дату початку показу.`;
        if (block.type === "countdown" && block.showFromDate && block.targetDate && Date.parse(block.showFromDate) >= Date.parse(block.targetDate)) return `Блок ${index + 1}: початок показу має бути раніше завершення відліку.`;
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
        const richFields = [block.richText, ...(block.items ?? []).map(item => item.richText)];
        for (const rich of richFields) for (const name of richTextVariableNames(rich)) if (!bindings.has(name)) return `Блок ${index + 1}: змінну ${name} потрібно додати через список.`;
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
