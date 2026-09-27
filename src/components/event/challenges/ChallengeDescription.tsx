import type {ReactNode} from "react";

type Node = {type?: unknown; text?: unknown; format?: unknown; tag?: unknown; url?: unknown; listType?: unknown; children?: unknown; root?: unknown};
const asNode = (value: unknown): Node | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Node : null;

function renderNode(value: unknown, key: number): ReactNode {
    const node = asNode(value);
    if (!node) return null;
    const children = Array.isArray(node.children) ? node.children.map(renderNode) : null;
    if (node.type === "text") {
        let text: ReactNode = typeof node.text === "string" ? node.text : "";
        const format = typeof node.format === "number" ? node.format : 0;
        if (format & 16) text = <code>{text}</code>;
        if (format & 8) text = <u>{text}</u>;
        if (format & 4) text = <s>{text}</s>;
        if (format & 2) text = <em>{text}</em>;
        if (format & 1) text = <strong>{text}</strong>;
        return <span key={key}>{text}</span>;
    }
    if (node.type === "linebreak") return <br key={key} />;
    if (node.type === "heading") {
        if (node.tag === "h2") return <h2 key={key} className="mt-5 text-lg font-semibold">{children}</h2>;
        if (node.tag === "h3") return <h3 key={key} className="mt-4 text-base font-semibold">{children}</h3>;
        return <h2 key={key} className="mt-5 text-xl font-semibold">{children}</h2>;
    }
    if (node.type === "paragraph") return <p key={key} className="my-3 first:mt-0">{children}</p>;
    if (node.type === "quote") return <blockquote key={key} className="my-3 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>;
    if (node.type === "list") return node.listType === "number"
        ? <ol key={key} className="my-3 list-decimal space-y-1 pl-5">{children}</ol>
        : <ul key={key} className="my-3 list-disc space-y-1 pl-5">{children}</ul>;
    if (node.type === "listitem") return <li key={key}>{children}</li>;
    if (node.type === "link" || node.type === "autolink") {
        const url = typeof node.url === "string" ? node.url : "";
        if (!/^https?:\/\//i.test(url)) return <span key={key}>{children}</span>;
        return <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>;
    }
    return <span key={key}>{children}</span>;
}

export function ChallengeDescription({document}: {document: unknown}) {
    const root = asNode(asNode(document)?.root);
    const children = Array.isArray(root?.children) ? root.children : [];
    if (!children.length) return <p className="text-sm text-muted-foreground">Опис завдання відсутній.</p>;
    return <div className="text-sm leading-relaxed text-foreground">{children.map(renderNode)}</div>;
}
