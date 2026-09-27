export type ContentRichText = {root: {type: "root"; children: unknown[]; [key: string]: unknown}; [key: string]: unknown};

type Node = Record<string, unknown>;

function asNode(value: unknown): Node | null {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Node : null;
}

function visit(value: unknown, callback: (node: Node) => void): void {
    const node = asNode(value);
    if (!node) return;
    callback(node);
    if (Array.isArray(node.children)) node.children.forEach(child => visit(child, callback));
}

export function emptyRichText(): ContentRichText {
    return {root: {type: "root", version: 1, children: [{type: "paragraph", version: 1, children: []}]}};
}

export function richTextHasContent(value: unknown): boolean {
    let found = false;
    visit(asNode(value)?.root, node => {
        if (node.type === "text" && typeof node.text === "string" && node.text.trim()) found = true;
        if (node.type === "variable" && typeof node.varName === "string" && node.varName) found = true;
    });
    return found;
}

export function richTextVariableNames(value: unknown): Set<string> {
    const names = new Set<string>();
    visit(asNode(value)?.root, node => {
        if (node.type === "variable" && typeof node.varName === "string") names.add(node.varName);
    });
    return names;
}

export function richTextPlainText(value: unknown, values: Record<string, unknown> = {}): string {
    function plain(node: unknown): string {
        const current = asNode(node);
        if (!current) return "";
        if (current.type === "text") return typeof current.text === "string" ? current.text : "";
        if (current.type === "variable") {
            const name = typeof current.varName === "string" ? current.varName : "";
            return values[name] == null ? name : String(values[name]);
        }
        const children = Array.isArray(current.children) ? current.children.map(plain).join("") : "";
        return current.type === "paragraph" || current.type === "heading" ? `${children}\n` : children;
    }
    return plain(asNode(value)?.root).trim();
}
