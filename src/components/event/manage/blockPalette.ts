import type {ContentBlock, PageBlockType} from "@/types/eventContent";
import {emptyRichText} from "../content/richTextState";
import {t} from "@/i18n/t";

export const blockPalette: {type: PageBlockType; label: string}[] = [
    {type: "section", label: t("manage.blocks.type.section")},
    {type: "text", label: t("manage.blocks.type.text")},
    {type: "hero", label: t("manage.blocks.type.hero")},
    {type: "banner", label: t("manage.blocks.type.banner")},
    {type: "facts", label: t("manage.blocks.type.facts")},
    {type: "timeline", label: t("manage.blocks.type.timeline")},
    {type: "doc", label: t("manage.blocks.type.doc")},
    {type: "faq", label: t("manage.blocks.type.faq")},
    {type: "cta", label: t("manage.blocks.type.cta")},
    {type: "countdown", label: t("manage.blocks.type.countdown")},
    {type: "partners", label: t("manage.blocks.type.partners")},
    {type: "divider", label: t("manage.blocks.type.divider")},
];

export function createPageBlock(type: PageBlockType, landing = false): ContentBlock {
    const id = `block-${crypto.randomUUID()}`;
    switch (type) {
        case "section": return {id, type, label: "", variant: "left"};
        case "text": return {id, type, richText: emptyRichText(), variant: "narrow"};
        case "hero": return {id, type, by: t("manage.blocks.default.heroBy"), title: "{{event.name}}", kicker: "", note: "", items: [], variant: landing ? "mass" : "plain", layout: "split", timerSize: "xl", timerDisplay: "segments", variables: [{name: "event.name", format: "text"}]};
        case "banner": return {id, type, title: "", variant: "frame", widthPercent: 100, imageSource: "preview"};
        case "facts": return {id, type, title: "", variant: "strip", items: [{label: "", value: ""}]};
        case "timeline": return {id, type, title: "", variant: "grid", items: [{dateSource: "event", dateVariable: "", dateFormat: "date-time", value: ""}]};
        case "doc": return {id, type, title: "", tocTitle: t("manage.blocks.default.tocTitle"), items: [{label: "", richText: emptyRichText()}]};
        case "faq": return {id, type, title: "", items: [{label: "", richText: emptyRichText()}]};
        case "cta": return {id, type, title: "", text: "", action: {label: "", kind: "link", href: ""}, variant: "plain"};
        case "countdown": return {id, type, title: "", text: "", dateSource: "event", targetVariable: "", showFromSource: "none", hideAfterFinish: false, variant: "split", timerSize: "large", timerDisplay: "segments", surface: "plain"};
        case "divider": return {id, type, size: "md", line: false};
        case "partners": return {id, type, title: t("manage.blocks.default.partnersTitle"), groups: [{title: "", items: []}]};
    }
}

// A copy placed after the original: a new id, no anchor (anchors are unique).
export function duplicatePageBlock(block: ContentBlock): ContentBlock {
    const copy = structuredClone(block);
    return {...copy, id: `block-${crypto.randomUUID()}`, anchor: undefined};
}
