import type {ContentBlock, PageBlockType} from "@/types/eventContent";

export const blockPalette: {type: PageBlockType; label: string}[] = [
    {type: "section", label: "Заголовок"},
    {type: "text", label: "Форматований текст"},
    {type: "hero", label: "Герой"},
    {type: "banner", label: "Банер з обкладинкою"},
    {type: "facts", label: "Факти й статистика"},
    {type: "timeline", label: "Розклад"},
    {type: "doc", label: "Зміст і текст"},
    {type: "faq", label: "Питання й відповіді"},
    {type: "cta", label: "Дія"},
    {type: "countdown", label: "Зворотний відлік"},
    {type: "divider", label: "Роздільник"},
];

export function createPageBlock(type: PageBlockType, landing = false): ContentBlock {
    const id = `block-${crypto.randomUUID()}`;
    switch (type) {
        case "section": return {id, type, label: "", variant: "left"};
        case "text": return {id, type, markdown: "", variant: "narrow"};
        case "hero": return {id, type, by: "Подія CyberICEBox", title: "{{event.name}}", kicker: "", note: "", items: [], variant: landing ? "mass" : "plain", variables: [{name: "event.name", format: "text"}]};
        case "banner": return {id, type, title: "", variant: "frame", widthPercent: 100};
        case "facts": return {id, type, title: "", variant: "strip", items: [{label: "", value: ""}]};
        case "timeline": return {id, type, title: "", variant: "grid", items: [{label: "", value: ""}]};
        case "doc": return {id, type, title: "", tocTitle: "Зміст", items: [{label: "", value: ""}]};
        case "faq": return {id, type, title: "", items: [{label: "", value: ""}]};
        case "cta": return {id, type, title: "", text: "", action: {label: "", href: ""}, variant: "plain"};
        case "countdown": return {id, type, title: "", text: "", targetVariable: "", variant: "split"};
        case "divider": return {id, type, size: "md", line: false};
    }
}
