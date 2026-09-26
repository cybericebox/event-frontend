import type {ContentBlock, PageBlockType} from "@/types/eventContent";

export const blockPalette: {type: PageBlockType; label: string}[] = [
    {type: "section", label: "Заголовок"},
    {type: "text", label: "Форматований текст"},
    {type: "facts", label: "Факти й статистика"},
    {type: "timeline", label: "Розклад"},
    {type: "faq", label: "Питання й відповіді"},
    {type: "cta", label: "Дія"},
    {type: "countdown", label: "Зворотний відлік"},
    {type: "divider", label: "Роздільник"},
];

export function createPageBlock(type: PageBlockType): ContentBlock {
    const id = `block-${crypto.randomUUID()}`;
    switch (type) {
        case "section": return {id, type, label: ""};
        case "text": return {id, type, markdown: ""};
        case "facts": return {id, type, title: "", items: [{label: "", value: ""}]};
        case "timeline": return {id, type, title: "", items: [{label: "", value: ""}]};
        case "faq": return {id, type, title: "", items: [{label: "", value: ""}]};
        case "cta": return {id, type, title: "", text: "", action: {label: "", href: ""}, variant: "plain"};
        case "countdown": return {id, type, title: "", text: "", targetVariable: ""};
        case "divider": return {id, type, size: "md", line: false};
    }
}
