import {blockLayoutProblems} from "./blockLayoutValidation";
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

export type LandingProblem = {index: number; field: string | null; message: string};

export function landingProblems(document: ContentDocument, catalog: ContentVariableDefinition[], coverImage = ""): LandingProblem[] {
    const problems: LandingProblem[] = [];
    const add = (index: number, key: ValidationKey, vars?: MessageVars, field?: string | null) => {
        const message = fail(index, key, vars);
        problems.push({index, message, field: field === undefined ? blockValidationField(message, document.blocks[index]) : field});
    };
    const contentVariableByName = new Map(catalog.map(variable => [variable.name, variable]));
    const ids = new Set<string>();
    for (const [index, block] of document.blocks.entries()) {
        for (const issue of blockLayoutProblems(block)) problems.push({index, field: issue.field, message: t("manage.validation.block", {index: index + 1, message: issue.message})});
        if (!block.id.trim() || ids.has(block.id)) add(index, "badId");
        ids.add(block.id);
        // A repeated anchor is reported at its later block.
        const anchorProblem = anchorError(block.anchor ?? "", [...document.blocks.filter(other => other.id !== block.id).map(other => other.id), ...document.blocks.slice(0, index).map(other => other.anchor ?? "")]);
        if (anchorProblem) add(index, anchorInvalid(block.anchor ?? "") ? "anchorInvalid" : "anchorTaken");
        if (block.type === "partners") {
            const groups = block.groups ?? [];
            if (!groups.length || groups.length > 10) add(index, "partnersGroups");
            for (const [groupIndex, group] of groups.entries()) {
                const groupField = `group:${groupIndex}`;
                if (!group.items.length || group.items.length > 24) add(index, "partnersLogos", undefined, `${groupField}:items`);
                if (/\{\{/.test(group.title ?? "")) add(index, "partnersVariables", undefined, `${groupField}:title`);
                for (const [logoIndex, logo] of group.items.entries()) {
                    const logoField = `${groupField}:logo:${logoIndex}`;
                    if (!logo.name.trim()) add(index, "partnersName", undefined, `${logoField}:name`);
                    if (/\{\{/.test(logo.name)) add(index, "partnersVariables", undefined, `${logoField}:name`);
                    if (!logo.imageURL.trim()) add(index, "partnersFile", undefined, `${logoField}:imageURL`);
                    if (logo.href && !validHref(logo.href)) add(index, "partnersHref", undefined, `${logoField}:href`);
                    if (/\{\{/.test(logo.href ?? "")) add(index, "partnersVariables", undefined, `${logoField}:href`);
                }
            }
        }
        const text = block.type === "section" ? block.label ?? "" : "";
        if (block.type === "section" && !text.trim()) add(index, "sectionLabel");
        if (block.type === "text" && !richTextHasContent(block.richText)) add(index, "textEmpty");
        if (block.type === "section" && block.variant && !["left", "center", "right", "justify"].includes(block.variant)) add(index, "sectionAlign");
        if (block.type === "text" && block.variant && !["narrow", "wide"].includes(block.variant)) add(index, "textWidth");
        if (block.type === "text" && block.layout) add(index, "textLayout");
        if (block.type === "timeline" && block.variant && !["grid", "list"].includes(block.variant)) add(index, "timelineLayout");
        if (block.type === "banner" && block.variant && !["edge", "frame"].includes(block.variant)) add(index, "bannerLayout");
        if (block.type === "banner" && block.layout && !["left", "center", "right"].includes(block.layout)) add(index, "bannerCaption");
        if (block.type === "banner" && block.widthPercent !== undefined && (block.widthPercent < 50 || block.widthPercent > 100 || block.widthPercent % 5 !== 0)) add(index, "bannerWidth");
        if (block.type === "banner" && block.imageSource === "custom" && !block.imageURL?.trim()) add(index, "bannerImage");
        if (block.type === "banner" && block.imageSource !== "custom" && !coverImage) add(index, "bannerCover");
        if (["facts", "faq"].includes(block.type) && !block.items?.length) add(index, "itemsEmpty", undefined, "items");
        if (block.type === "timeline") {
            if (!block.items?.length) add(index, "timelineEmpty");
            for (const [itemIndex, item] of (block.items ?? []).entries()) {
                if (!item.value?.trim()) problems.push({index, field: `item:${itemIndex}:value`, message: fail(index, "timelineTitle")});
                if ([...(item.value ?? "").matchAll(tokenPattern)].some(([, name]) => catalog.some(variable => variable.name === name && variable.format === "date-time"))) problems.push({index, field: `item:${itemIndex}:value`, message: fail(index, "timelineTitleVariable")});
                if (item.dateSource === "custom") {
                    if (!item.dateValue || Number.isNaN(Date.parse(item.dateValue))) problems.push({index, field: `item:${itemIndex}:dateValue`, message: fail(index, "timelineDate")});
                } else if (item.dateSource !== "event" || !!item.dateValue || !catalog.some(variable => variable.name === item.dateVariable && variable.format === "date-time") || !block.variables?.some(binding => binding.name === item.dateVariable && binding.format === "date-time")) problems.push({index, field: `item:${itemIndex}:dateVariable`, message: fail(index, "timelineEventDate")});
                if (item.dateFormat === "custom" && !validDatePattern(item.datePattern ?? "")) problems.push({index, field: `item:${itemIndex}:datePattern`, message: fail(index, "timelineFormat")});
            }
        }
        if (block.type === "faq" && block.openItem !== undefined && (block.openItem < 0 || block.openItem >= (block.items?.length ?? 0))) add(index, "faqOpen");
        if (block.type === "doc" && !block.items?.length) add(index, "docSections", undefined, "items");
        if (block.type === "cta" && !block.action?.label.trim()) add(index, "ctaLabel");
        if (block.type === "cta" && block.action?.kind !== "join_event" && !block.action?.href?.trim()) add(index, "ctaHref");
        if (block.type === "cta" && block.action?.kind !== "join_event" && block.action && !validHref(block.action.href ?? "")) add(index, "ctaHrefUnsafe");
        if (block.type === "cta" && block.action?.kind === "join_event" && block.action.href?.trim()) add(index, "joinNoHref");
        if (block.type === "cta" && block.variant && !["plain", "mass"].includes(block.variant)) add(index, "ctaVariant");
        if (block.type === "cta" && block.secondaryAction && !block.secondaryAction.label.trim()) add(index, "secondaryLabel");
        if (block.type === "cta" && block.secondaryAction?.kind !== "join_event" && block.secondaryAction && !block.secondaryAction.href?.trim()) add(index, "secondaryHref");
        if (block.type === "cta" && block.secondaryAction?.kind !== "join_event" && block.secondaryAction && !validHref(block.secondaryAction.href ?? "")) add(index, "secondaryHrefUnsafe");
        if (block.type === "cta" && block.secondaryAction?.kind === "join_event" && block.secondaryAction.href?.trim()) add(index, "joinNoHref");
        if (block.type === "facts" && block.variant && !["strip", "rows"].includes(block.variant)) add(index, "factsLayout");
        if (block.type === "hero") {
            if (!block.title?.trim()) add(index, "heroTitle");
            if (block.variant && !["mass", "plain"].includes(block.variant)) add(index, "heroVariant");
            if (block.layout && !["split", "center"].includes(block.layout)) add(index, "heroLayout");
            if (block.timerSize && !["large", "xl"].includes(block.timerSize)) add(index, "heroTimerSize");
            if ((block.items?.length ?? 0) > 4) add(index, "heroFacts", undefined, "items");
            if (block.targetVariable && !catalog.some(item => item.name === block.targetVariable && item.format === "date-time")) add(index, "dateVariableUnavailable");
        }
        if ((block.type === "hero" || block.type === "countdown") && block.targetVariable && block.targetDate) add(index, "dateSourceSingle");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource && !["none", "event", "custom"].includes(block.dateSource)) add(index, "dateSourceUnknown");
        if ((block.type === "hero" || block.type === "countdown") && block.timerDisplay && !["segments", "compact", "tiles", "focus", "dial", "ledger", "poster", "tracks", "flip", "ticker", "stairs", "orbits", "matrix", "ribbon", "rings"].includes(block.timerDisplay)) add(index, "timerDisplayUnknown");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "none" && (block.type === "countdown" || block.targetVariable || block.targetDate)) add(index, "dateSourceMismatch");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "event" && block.targetDate) add(index, "dateSourceMismatch");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "custom" && block.targetVariable) add(index, "dateSourceMismatch");
        if ((block.type === "hero" || block.type === "countdown") && block.dateSource === "custom" && !block.targetDate) add(index, "customDateRequired");
        if (block.type === "countdown" && block.dateSource === "event" && !block.targetVariable) add(index, "countdownEventDate");
        if ((block.type === "hero" || block.type === "countdown") && block.targetDate && (Number.isNaN(Date.parse(block.targetDate)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(block.targetDate))) add(index, "dateTimeInvalid");
        if (block.type === "countdown" && !block.targetDate && (!block.targetVariable || !catalog.some(item => item.name === block.targetVariable && item.format === "date-time"))) add(index, "countdownDateRequired");
        if (block.type === "countdown" && block.variant && !["split", "center", "inline"].includes(block.variant)) add(index, "countdownLayout");
        if (block.type === "countdown" && block.verticalAlignment && !["start", "center", "end"].includes(block.verticalAlignment)) add(index, "countdownAlignment");
        if (block.type === "countdown" && block.timerSize && !["large", "xl"].includes(block.timerSize)) add(index, "countdownSize");
        if (block.type === "countdown" && block.surface && !["plain", "frame"].includes(block.surface)) add(index, "countdownSurface");
        if (block.type === "countdown" && block.showFromSource && !["none", "event", "custom"].includes(block.showFromSource)) add(index, "showFromUnknown");
        if (block.type === "countdown" && (!block.showFromSource || block.showFromSource === "none") && (block.showFromDate || block.showFromVariable)) add(index, "showFromMismatch");
        if (block.type === "countdown" && block.showFromSource === "event" && (!block.showFromVariable || !!block.showFromDate || !catalog.some(item => item.name === block.showFromVariable && item.format === "date-time") || !block.variables?.some(binding => binding.name === block.showFromVariable))) add(index, "showFromVariable");
        if (block.type === "countdown" && block.showFromSource === "custom" && (block.showFromVariable || !block.showFromDate || Number.isNaN(Date.parse(block.showFromDate)))) add(index, "showFromDateInvalid");
        if (block.type === "countdown" && block.showFromDate && block.targetDate && Date.parse(block.showFromDate) >= Date.parse(block.targetDate)) add(index, "showFromOrder");
        if (["facts", "faq", "doc", "hero"].includes(block.type)) {
            (block.items ?? []).forEach((item, itemIndex) => {
                const key = block.type === "doc" ? "docSections" : block.type === "hero" ? "heroFacts" : "itemsEmpty";
                const message = fail(index, key);
                if (!item.label?.trim()) problems.push({index, field: `item:${itemIndex}:label`, message});
                const rich = block.type === "faq" || block.type === "doc";
                if (rich ? !richTextHasContent(item.richText) : !item.value?.trim()) problems.push({index, field: `item:${itemIndex}:${rich ? "richText" : "value"}`, message});
            });
        }
        const bindings = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
        const fields: [string, string][] = [["label", text], ...["title", "sub", "text", "by", "kicker", "note", "tocTitle"].map(field => [field, block[field as "title"] ?? ""] as [string, string]),
            ["action:label", block.action?.label ?? ""], ["action:href", block.action?.href ?? ""], ["secondaryAction:label", block.secondaryAction?.label ?? ""], ["secondaryAction:href", block.secondaryAction?.href ?? ""],
            ...(block.items ?? []).flatMap((item, itemIndex): [string, string][] => [[`item:${itemIndex}:label`, item.label ?? ""], [`item:${itemIndex}:value`, item.value ?? ""]])];
        const checkVariable = (name: string, field: string) => {
            const format = bindings.get(name);
            if (!format) add(index, "variableNotAdded", {name}, field);
            else if (contentVariableByName.get(name)?.format !== format) add(index, "variableUnavailable", {name}, field);
        };
        for (const [field, value] of fields) for (const [, name] of value.matchAll(tokenPattern)) checkVariable(name, field);
        const richFields = [["richText", block.richText], ...(block.items ?? []).map((item, itemIndex) => [`item:${itemIndex}:richText`, item.richText] as const)] as const;
        for (const [field, rich] of richFields) for (const name of richTextVariableNames(rich)) checkVariable(name, field);
        for (const [field, displays] of Object.entries(block.dateDisplays ?? {})) {
            for (const display of Object.values(displays)) {
                if (display.format === "custom" && !validDatePattern(display.pattern ?? "")) add(index, "dateFormatInvalid", undefined, `dateDisplays:${field}`);
            }
        }
        if ((block.type === "hero" || block.type === "countdown") && block.targetVariable && !bindings.has(block.targetVariable)) add(index, "dateVariableNotAdded", undefined, "targetVariable");
        for (const [ruleIndex, rule] of (block.visibility ?? []).entries()) {
            const field = `rule:${ruleIndex}`;
            const format = bindings.get(rule.variable);
            const definition = contentVariableByName.get(rule.variable);
            if (!format) add(index, "conditionNotAdded", undefined, `${field}:variable`);
            else if (definition?.format !== format) add(index, "variableUnavailable", {name: rule.variable}, `${field}:variable`);
            if (definition && !visibilityOperators(definition.format).some(operator => operator.value === rule.operator)) add(index, "conditionInvalid", undefined, `${field}:operator`);
            if (format === "number" && (typeof rule.value !== "number" || !Number.isFinite(rule.value))) add(index, "conditionNumber", undefined, `${field}:value`);
            if (format === "boolean" && typeof rule.value !== "boolean") add(index, "conditionBoolean", undefined, `${field}:value`);
            if (format === "text" && typeof rule.value !== "string") add(index, "conditionText", undefined, `${field}:value`);
            if (format === "date-time" && (typeof rule.value !== "string" || Number.isNaN(Date.parse(rule.value)))) add(index, "conditionDate", undefined, `${field}:value`);
        }
        // Unused stale bindings have no source control; report them on the block.
        for (const variable of block.variables ?? []) if (contentVariableByName.get(variable.name)?.format !== variable.format && !problems.some(problem => problem.index === index && problem.message === fail(index, "variableUnavailable", {name: variable.name}))) add(index, "variableUnavailable", {name: variable.name}, null);
    }
    return problems;
}

export function validateLanding(document: ContentDocument, catalog: ContentVariableDefinition[], coverImage = ""): string | null {
    return landingProblems(document, catalog, coverImage)[0]?.message ?? null;
}
