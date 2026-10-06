import type {ContentBlock, ContentDocument} from "../../../types/eventContent";
import {visibilityOperators, type ContentVariableDefinition} from "../content/variableCatalog";
import {validDatePattern} from "../content/dateDisplay";
import {richTextHasContent, richTextVariableNames} from "../content/richTextState";
import {anchorError, anchorPattern, maxAnchorLength} from "./blockAnchor";
import {t, type MessageVars} from "@/i18n/t";

const tokenPattern = /\{\{([a-z][a-zA-Z0-9.]*)\}\}/g;

type ValidationKey = keyof typeof validationFields | "badId" | "sectionAlign" | "textWidth" | "textLayout" | "timelineLayout" | "bannerLayout" | "bannerCaption" | "bannerWidth" | "timelineEmpty"
    | "faqOpen" | "joinNoHref" | "ctaVariant" | "factsLayout" | "heroVariant" | "heroLayout" | "heroTimerSize" | "dateSourceSingle" | "dateSourceUnknown" | "timerDisplayUnknown" | "dateSourceMismatch"
    | "countdownLayout" | "countdownAlignment" | "countdownSize" | "countdownSurface" | "showFromUnknown" | "showFromMismatch" | "variableUnavailable" | "dateVariableNotAdded" | "variableNotAdded"
    | "conditionNotAdded" | "conditionInvalid" | "conditionNumber" | "conditionBoolean" | "conditionText" | "conditionDate";

// Messages that point at one editor field; the rest are reported on the block.
const validationFields = {
    anchorInvalid: "anchor", anchorTaken: "anchor",
    partnersGroups: "groups", partnersLogos: "groups", partnersVariables: "groups", partnersName: "groups", partnersFile: "groups", partnersHref: "groups",
    sectionLabel: "label", textEmpty: "richText", heroTitle: "title",
    ctaLabel: "action:label", ctaHref: "action:href", ctaHrefUnsafe: "action:href",
    secondaryLabel: "secondaryAction:label", secondaryHref: "secondaryAction:href", secondaryHrefUnsafe: "secondaryAction:href",
    bannerImage: "imageURL", bannerCover: "imageSource",
    customDateRequired: "targetDate", dateTimeInvalid: "targetDate",
    showFromVariable: "showFromVariable", showFromDateInvalid: "showFromDate", showFromOrder: "showFromDate",
    countdownEventDate: "targetVariable", countdownDateRequired: "targetVariable", dateVariableUnavailable: "targetVariable",
    dateFormatInvalid: "dateDisplays", itemsEmpty: "item", docSections: "item", heroFacts: "item",
    timelineTitle: "timeline", timelineDate: "timeline", timelineFormat: "timeline", timelineEventDate: "timeline", timelineTitleVariable: "timelineVariable",
} as const;

function fail(index: number, key: ValidationKey, vars?: MessageVars): string {
    return t("manage.validation.block", {index: index + 1, message: t(`manage.validation.${key}`, vars)});
}

function anchorInvalid(anchor: string): boolean {
    return anchor.length > maxAnchorLength || !anchorPattern.test(anchor);
}

// Splits "Block N: message" using the active template, so parsing never
// depends on the UI language.
function parseBlockError(error: string | null | undefined): {index: number; message: string} | null {
    const template = t("manage.validation.block");
    const indexFirst = template.indexOf("{index}") < template.indexOf("{message}");
    const source = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\{index\\}", "(\\d+)").replace("\\{message\\}", "([\\s\\S]*)");
    const match = new RegExp(`^${source}$`).exec(error ?? "");
    if (!match) return null;
    return {index: Number(indexFirst ? match[1] : match[2]) - 1, message: indexFirst ? match[2] : match[1]};
}

function messageKey(message: string): keyof typeof validationFields | null {
    return (Object.keys(validationFields) as (keyof typeof validationFields)[]).find(key => t(`manage.validation.${key}`) === message) ?? null;
}

export function blockValidationIndex(error: string | null): number | null {
    return parseBlockError(error)?.index ?? null;
}

export function blockValidationField(error: string | undefined, block: ContentBlock): string | null {
    const key = messageKey(parseBlockError(error)?.message ?? "");
    if (!key) return null;
    const field = validationFields[key];
    if (field === "dateDisplays") {
        const name = Object.entries(block.dateDisplays ?? {}).find(([, formats]) => Object.values(formats).some(display => display.format === "custom" && !validDatePattern(display.pattern ?? "")))?.[0];
        return name ? `dateDisplays:${name}` : null;
    }
    if (field === "item") {
        const itemIndex = block.items?.findIndex(item => !item.label?.trim() || (block.type === "faq" || block.type === "doc" ? !richTextHasContent(item.richText) : !item.value?.trim())) ?? -1;
        return itemIndex >= 0 ? `item:${itemIndex}:${block.items?.[itemIndex].label?.trim() ? block.type === "faq" || block.type === "doc" ? "richText" : "value" : "label"}` : null;
    }
    if (field === "timeline") {
        if (block.type !== "timeline") return null;
        const index = block.items?.findIndex(item => {
            if (key === "timelineTitle") return !item.value?.trim();
            if (key === "timelineDate") return item.dateSource === "custom" && (!item.dateValue || Number.isNaN(Date.parse(item.dateValue)));
            if (key === "timelineFormat") return item.dateFormat === "custom" && !validDatePattern(item.datePattern ?? "");
            return item.dateSource !== "custom" && !item.dateVariable;
        }) ?? -1;
        const itemIndex = index < 0 ? 0 : index;
        if (key === "timelineTitle") return `item:${itemIndex}:value`;
        if (key === "timelineDate") return `item:${itemIndex}:dateValue`;
        if (key === "timelineFormat") return `item:${itemIndex}:datePattern`;
        return `item:${itemIndex}:dateVariable`;
    }
    if (field === "timelineVariable") {
        if (block.type !== "timeline") return null;
        const index = block.items?.findIndex(item => [...(item.value ?? "").matchAll(tokenPattern)].some(([, name]) => block.variables?.some(binding => binding.name === name && binding.format === "date-time"))) ?? -1;
        return index >= 0 ? `item:${index}:value` : null;
    }
    return field;
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
        if (!block.id.trim() || ids.has(block.id)) return fail(index, "badId");
        ids.add(block.id);
        // A repeated anchor is reported at its later block.
        const anchorProblem = anchorError(block.anchor ?? "", [...document.blocks.filter(other => other.id !== block.id).map(other => other.id), ...document.blocks.slice(0, index).map(other => other.anchor ?? "")]);
        if (anchorProblem) return fail(index, anchorInvalid(block.anchor ?? "") ? "anchorInvalid" : "anchorTaken");
        if (block.type === "partners") {
            const groups = block.groups ?? [];
            if (!groups.length || groups.length > 10) return fail(index, "partnersGroups");
            for (const group of groups) {
                if (!group.items.length || group.items.length > 24) return fail(index, "partnersLogos");
                if ([group.title ?? "", ...group.items.flatMap(logo => [logo.name, logo.href ?? ""])].some(text => /\{\{/.test(text))) return fail(index, "partnersVariables");
                for (const logo of group.items) {
                    if (!logo.name.trim()) return fail(index, "partnersName");
                    if (!logo.imageURL.trim()) return fail(index, "partnersFile");
                    if (logo.href && !validHref(logo.href)) return fail(index, "partnersHref");
                }
            }
        }
        const text = block.type === "section" ? block.label ?? "" : "";
        if (block.type === "section" && !text.trim()) return fail(index, "sectionLabel");
        if (block.type === "text" && !richTextHasContent(block.richText)) return fail(index, "textEmpty");
        if (block.type === "section" && block.variant && !["left", "center", "right", "justify"].includes(block.variant)) return fail(index, "sectionAlign");
        if (block.type === "text" && block.variant && !["narrow", "wide"].includes(block.variant)) return fail(index, "textWidth");
        if (block.type === "text" && block.layout) return fail(index, "textLayout");
        if (block.type === "timeline" && block.variant && !["grid", "list"].includes(block.variant)) return fail(index, "timelineLayout");
        if (block.type === "banner" && block.variant && !["edge", "frame"].includes(block.variant)) return fail(index, "bannerLayout");
        if (block.type === "banner" && block.layout && !["left", "center", "right"].includes(block.layout)) return fail(index, "bannerCaption");
        if (block.type === "banner" && block.widthPercent !== undefined && (block.widthPercent < 50 || block.widthPercent > 100 || block.widthPercent % 5 !== 0)) return fail(index, "bannerWidth");
        if (block.type === "banner" && block.imageSource === "custom" && !block.imageURL?.trim()) return fail(index, "bannerImage");
        if (block.type === "banner" && block.imageSource !== "custom" && !coverImage) return fail(index, "bannerCover");
        if (["facts", "faq"].includes(block.type) && (!block.items?.length || block.items.some(item => !item.label?.trim() || (block.type === "faq" ? !richTextHasContent(item.richText) : !item.value?.trim())))) return fail(index, "itemsEmpty");
        if (block.type === "timeline") {
            if (!block.items?.length) return fail(index, "timelineEmpty");
            for (const item of block.items) {
                if (!item.value?.trim()) return fail(index, "timelineTitle");
                if ([...item.value.matchAll(tokenPattern)].some(([, name]) => catalog.some(variable => variable.name === name && variable.format === "date-time"))) return fail(index, "timelineTitleVariable");
                if (item.dateSource === "custom") {
                    if (!item.dateValue || Number.isNaN(Date.parse(item.dateValue))) return fail(index, "timelineDate");
                } else if (item.dateSource !== "event" || !!item.dateValue || !catalog.some(variable => variable.name === item.dateVariable && variable.format === "date-time") || !block.variables?.some(binding => binding.name === item.dateVariable && binding.format === "date-time")) return fail(index, "timelineEventDate");
                if (item.dateFormat === "custom" && !validDatePattern(item.datePattern ?? "")) return fail(index, "timelineFormat");
            }
        }
        if (block.type === "faq" && block.openItem !== undefined && (block.openItem < 0 || block.openItem >= (block.items?.length ?? 0))) return fail(index, "faqOpen");
        if (block.type === "doc" && (!block.items?.length || block.items.some(item => !item.label?.trim() || !richTextHasContent(item.richText)))) return fail(index, "docSections");
        if (block.type === "cta" && !block.action?.label.trim()) return fail(index, "ctaLabel");
        if (block.type === "cta" && block.action?.kind !== "join_event" && !block.action?.href?.trim()) return fail(index, "ctaHref");
        if (block.type === "cta" && block.action?.kind !== "join_event" && block.action && !validHref(block.action.href ?? "")) return fail(index, "ctaHrefUnsafe");
        if (block.type === "cta" && block.action?.kind === "join_event" && block.action.href?.trim()) return fail(index, "joinNoHref");
        if (block.type === "cta" && block.variant && !["plain", "mass"].includes(block.variant)) return fail(index, "ctaVariant");
        if (block.type === "cta" && block.secondaryAction && !block.secondaryAction.label.trim()) return fail(index, "secondaryLabel");
        if (block.type === "cta" && block.secondaryAction?.kind !== "join_event" && block.secondaryAction && !block.secondaryAction.href?.trim()) return fail(index, "secondaryHref");
        if (block.type === "cta" && block.secondaryAction?.kind !== "join_event" && block.secondaryAction && !validHref(block.secondaryAction.href ?? "")) return fail(index, "secondaryHrefUnsafe");
        if (block.type === "cta" && block.secondaryAction?.kind === "join_event" && block.secondaryAction.href?.trim()) return fail(index, "joinNoHref");
        if (block.type === "facts" && block.variant && !["strip", "rows"].includes(block.variant)) return fail(index, "factsLayout");
        if (block.type === "hero") {
            if (!block.title?.trim()) return fail(index, "heroTitle");
            if (block.variant && !["mass", "plain"].includes(block.variant)) return fail(index, "heroVariant");
            if (block.layout && !["split", "center"].includes(block.layout)) return fail(index, "heroLayout");
            if (block.timerSize && !["large", "xl"].includes(block.timerSize)) return fail(index, "heroTimerSize");
            if ((block.items?.length ?? 0) > 4 || block.items?.some(item => !item.label?.trim() || !item.value?.trim())) return fail(index, "heroFacts");
            if (block.targetVariable && !catalog.some(item => item.name === block.targetVariable && item.format === "date-time")) return fail(index, "dateVariableUnavailable");
        }
        if ((block.type === "hero" || block.type === "countdown") && block.targetVariable && block.targetDate) return fail(index, "dateSourceSingle");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource && !["none", "event", "custom"].includes(block.dateSource)) return fail(index, "dateSourceUnknown");
        if ((block.type === "hero" || block.type === "countdown") && block.timerDisplay && !["segments", "compact", "tiles", "focus", "dial", "ledger", "poster", "tracks", "flip", "ticker", "stairs", "orbits", "matrix", "ribbon", "rings"].includes(block.timerDisplay)) return fail(index, "timerDisplayUnknown");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "none" && (block.type === "countdown" || block.targetVariable || block.targetDate)) return fail(index, "dateSourceMismatch");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "event" && block.targetDate) return fail(index, "dateSourceMismatch");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "custom" && block.targetVariable) return fail(index, "dateSourceMismatch");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "custom" && !block.targetDate) return fail(index, "customDateRequired");
        if (block.type === "countdown" && block.dateSource === "event" && !block.targetVariable) return fail(index, "countdownEventDate");
        if ((block.type === "hero" || block.type === "countdown") && block.targetDate && (Number.isNaN(Date.parse(block.targetDate)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(block.targetDate))) return fail(index, "dateTimeInvalid");
        if (block.type === "countdown" && !block.targetDate && (!block.targetVariable || !catalog.some(item => item.name === block.targetVariable && item.format === "date-time"))) return fail(index, "countdownDateRequired");
        if (block.type === "countdown" && block.variant && !["split", "center"].includes(block.variant)) return fail(index, "countdownLayout");
        if (block.type === "countdown" && block.verticalAlignment && !["start", "center", "end"].includes(block.verticalAlignment)) return fail(index, "countdownAlignment");
        if (block.type === "countdown" && block.timerSize && !["large", "xl"].includes(block.timerSize)) return fail(index, "countdownSize");
        if (block.type === "countdown" && block.surface && !["plain", "frame"].includes(block.surface)) return fail(index, "countdownSurface");
        if (block.type === "countdown" && block.showFromSource && !["none", "event", "custom"].includes(block.showFromSource)) return fail(index, "showFromUnknown");
        if (block.type === "countdown" && (!block.showFromSource || block.showFromSource === "none") && (block.showFromDate || block.showFromVariable)) return fail(index, "showFromMismatch");
        if (block.type === "countdown" && block.showFromSource === "event" && (!block.showFromVariable || !!block.showFromDate || !catalog.some(item => item.name === block.showFromVariable && item.format === "date-time") || !block.variables?.some(binding => binding.name === block.showFromVariable))) return fail(index, "showFromVariable");
        if (block.type === "countdown" && block.showFromSource === "custom" && (block.showFromVariable || !block.showFromDate || Number.isNaN(Date.parse(block.showFromDate)))) return fail(index, "showFromDateInvalid");
        if (block.type === "countdown" && block.showFromDate && block.targetDate && Date.parse(block.showFromDate) >= Date.parse(block.targetDate)) return fail(index, "showFromOrder");
        const bindings = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
        for (const variable of block.variables ?? []) {
            if (contentVariableByName.get(variable.name)?.format !== variable.format) return fail(index, "variableUnavailable", {name: variable.name});
        }
        for (const displays of Object.values(block.dateDisplays ?? {})) {
            for (const display of Object.values(displays)) {
                if (display.format === "custom" && !validDatePattern(display.pattern ?? "")) return fail(index, "dateFormatInvalid");
            }
        }
        if ((block.type === "hero" || block.type === "countdown") && block.targetVariable && !bindings.has(block.targetVariable)) return fail(index, "dateVariableNotAdded");
        const fields = [text, block.title ?? "", block.sub ?? "", block.text ?? "", block.by ?? "", block.kicker ?? "", block.note ?? "", block.tocTitle ?? "", block.action?.label ?? "", block.action?.href ?? "", block.secondaryAction?.label ?? "", block.secondaryAction?.href ?? "", ...(block.items ?? []).flatMap(item => [item.label ?? "", item.value ?? ""])];
        for (const field of fields) {
            for (const [, variable] of field.matchAll(tokenPattern)) {
                if (!bindings.has(variable)) return fail(index, "variableNotAdded", {name: variable});
            }
        }
        const richFields = [block.richText, ...(block.items ?? []).map(item => item.richText)];
        for (const rich of richFields) for (const name of richTextVariableNames(rich)) if (!bindings.has(name)) return fail(index, "variableNotAdded", {name});
        for (const rule of block.visibility ?? []) {
            const format = bindings.get(rule.variable);
            if (!format) return fail(index, "conditionNotAdded");
            const definition = contentVariableByName.get(rule.variable);
            if (definition && !visibilityOperators(definition.format).some(operator => operator.value === rule.operator)) return fail(index, "conditionInvalid");
            if (format === "number" && (typeof rule.value !== "number" || !Number.isFinite(rule.value))) return fail(index, "conditionNumber");
            if (format === "boolean" && typeof rule.value !== "boolean") return fail(index, "conditionBoolean");
            if (format === "text" && typeof rule.value !== "string") return fail(index, "conditionText");
            if (format === "date-time" && (typeof rule.value !== "string" || Number.isNaN(Date.parse(rule.value)))) return fail(index, "conditionDate");
        }
    }
    return null;
}
