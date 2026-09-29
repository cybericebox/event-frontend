import type {ContentBlock, PageBlockType} from "@/types/eventContent";
import {emptyRichText} from "../content/richTextState";

export const blockPalette: {type: PageBlockType; label: string}[] = [
    {type: "section", label: "Заголовок"},
    {type: "text", label: "Форматований текст"},
    {type: "hero", label: "Герой"},
    {type: "banner", label: "Банер"},
    {type: "facts", label: "Факти й статистика"},
    {type: "timeline", label: "Розклад"},
    {type: "doc", label: "Зміст і текст"},
    {type: "faq", label: "Питання й відповіді"},
    {type: "cta", label: "Дія"},
    {type: "countdown", label: "Зворотний відлік"},
    {type: "partners", label: "Партнери"},
    {type: "divider", label: "Роздільник"},
];

export function createPageBlock(type: PageBlockType, landing = false): ContentBlock {
    const id = `block-${crypto.randomUUID()}`;
    switch (type) {
        case "section": return {id, type, label: "", variant: "left"};
        case "text": return {id, type, richText: emptyRichText(), variant: "narrow"};
        case "hero": return {id, type, by: "Подія CyberICEBox", title: "{{event.name}}", kicker: "", note: "", items: [], variant: landing ? "mass" : "plain", layout: "split", timerSize: "xl", timerDisplay: "segments", variables: [{name: "event.name", format: "text"}]};
        case "banner": return {id, type, title: "", variant: "frame", widthPercent: 100, imageSource: "preview"};
        case "facts": return {id, type, title: "", variant: "strip", items: [{label: "", value: ""}]};
        case "timeline": return {id, type, title: "", variant: "grid", items: [{dateSource: "event", dateVariable: "", dateFormat: "date-time", value: ""}]};
        case "doc": return {id, type, title: "", tocTitle: "Зміст", items: [{label: "", richText: emptyRichText()}]};
        case "faq": return {id, type, title: "", items: [{label: "", richText: emptyRichText()}]};
        case "cta": return {id, type, title: "", text: "", action: {label: "", kind: "link", href: ""}, variant: "plain"};
        case "countdown": return {id, type, title: "", text: "", dateSource: "event", targetVariable: "", showFromSource: "none", hideAfterFinish: false, variant: "split", timerSize: "large", timerDisplay: "segments", surface: "plain"};
        case "divider": return {id, type, size: "md", line: false};
        case "partners": return {id, type, title: "Партнери", groups: [{title: "", items: []}]};
    }
}

// A copy placed after the original: a new id, no anchor (anchors are unique).
export function duplicatePageBlock(block: ContentBlock): ContentBlock {
    const copy = structuredClone(block);
    return {...copy, id: `block-${crypto.randomUUID()}`, anchor: undefined};
}
