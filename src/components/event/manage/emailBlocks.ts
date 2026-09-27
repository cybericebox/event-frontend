import type {ManageEmailBlock} from "@/api/manageEmailTemplates";

type EmailNode = {type?: string; text?: string; varName?: string; format?: string | number; children?: EmailNode[]};

function nodeText(node: EmailNode): string {
    if (node.type === "variable") return `{{${node.varName ?? ""}}}`;
    if (node.type === "linebreak") return "\n";
    return `${node.text ?? ""}${(node.children ?? []).map(nodeText).join("")}`;
}

export function emailRichText(block: ManageEmailBlock): string {
    if (block.type !== "rich_text") return "";
    const content = block.content as {root?: {children?: EmailNode[]}} | undefined;
    return (content?.root?.children ?? []).map(nodeText).join("\n\n");
}

export function isSimpleEmailRichText(block: ManageEmailBlock): boolean {
    if (block.type !== "rich_text") return false;
    const content = block.content as {root?: {children?: Array<EmailNode & {format?: string | number}>}} | undefined;
    return (content?.root?.children ?? []).every(node => node.type === "paragraph" && (node.children ?? []).every(child =>
        (child.type === "text" && (!('format' in child) || child.format === 0)) || child.type === "variable" || child.type === "linebreak"));
}

function paragraphNodes(text: string): EmailNode[] {
    const nodes: EmailNode[] = [];
    const expression = /\{\{\.?([A-Za-z_][A-Za-z_0-9]*)\}\}/g;
    let position = 0;
    for (const match of text.matchAll(expression)) {
        const start = match.index ?? position;
        if (start > position) nodes.push({type: "text", text: text.slice(position, start)});
        nodes.push({type: "variable", varName: match[1]});
        position = start + match[0].length;
    }
    if (position < text.length) nodes.push({type: "text", text: text.slice(position)});
    return nodes;
}

export function emailRichTextBlock(text: string): ManageEmailBlock {
    return {type: "rich_text", content: {root: {type: "root", version: 1, direction: null, format: "", indent: 0,
        children: text.split(/\n\s*\n/).map(paragraph => ({type: "paragraph", version: 1, direction: null, format: "", indent: 0, children: paragraphNodes(paragraph)})),
    }}};
}

export function emailBlockTitle(block: ManageEmailBlock): string {
    if (block.type === "rich_text") return "Текст";
    if (block.type === "button") return "Кнопка";
    if (block.type === "divider") return "Роздільник";
    if (block.type === "logo") return "Логотип";
    if (block.type === "image") return "Зображення";
    if (block.type === "preset") return "Готовий блок";
    return "Блок листа";
}
