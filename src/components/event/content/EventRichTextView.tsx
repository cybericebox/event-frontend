import type {CSSProperties, ReactNode} from "react";
import {formatDateTime} from "./dateDisplay";
import type {ContentRichText} from "./richTextState";

type Node = Record<string, unknown>;
type Value = string | number | boolean | null;
type Display = {format: "date-time" | "date" | "time" | "short" | "custom"; pattern?: string};
const asNode = (value: unknown): Node | null => value && typeof value === "object" && !Array.isArray(value) ? value as Node : null;

function safeHref(href: unknown): string | null {
    if (typeof href !== "string" || !href || /[\\\r\n\t]/.test(href) || href.startsWith("//")) return null;
    if (href.startsWith("/") || href.startsWith("#")) return href;
    try {const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password ? url.href : null;} catch {return null;}
}
function alignment(node: Node): CSSProperties | undefined {
    const format = node.format;
    const value = typeof format === "string" ? format : ({1: "left", 2: "center", 3: "right", 4: "justify"} as Record<number, string>)[Number(format)];
    return value === "center" || value === "right" || value === "justify" ? {textAlign: value} : undefined;
}
function formattedText(text: string, format: unknown): ReactNode {
    const flags = typeof format === "number" ? format : 0;
    let result: ReactNode = text;
    if (flags & 16) result = <code className="event-lexical__inline-code">{result}</code>;
    if (flags & 8) result = <u>{result}</u>;
    if (flags & 4) result = <s>{result}</s>;
    if (flags & 2) result = <em>{result}</em>;
    if (flags & 1) result = <strong>{result}</strong>;
    return result;
}

export function EventRichTextView({value, variables = {}, dateDisplays, emptyFallback}: {
    value?: ContentRichText | null | unknown;
    variables?: Record<string, Value>;
    dateDisplays?: Record<string, Display>;
    emptyFallback?: ReactNode;
}) {
    const root = asNode(asNode(value)?.root);
    if (root?.type !== "root" || !Array.isArray(root.children) || !root.children.length) return <>{emptyFallback ?? null}</>;
    function render(value: unknown, key: number): ReactNode {
        const node = asNode(value);
        if (!node) return null;
        const children = Array.isArray(node.children) ? node.children.map(render) : null;
        switch (node.type) {
            case "text": return <span key={key}>{formattedText(typeof node.text === "string" ? node.text : "", node.format)}</span>;
            case "variable": {
                const name = typeof node.varName === "string" ? node.varName : "";
                if (!name) return null;
                const raw = variables[name];
                const display = dateDisplays?.[name];
                const text = typeof raw === "string" && display && !Number.isNaN(Date.parse(raw)) ? formatDateTime(raw, display.format, display.pattern)
                    : typeof raw === "boolean" ? raw ? "Так" : "Ні" : raw == null ? name : String(raw);
                const formats = Array.isArray(node.formats) ? node.formats : [];
                return <span key={key} className="event-lexical__variable" data-event-variable={name} title={name}
                    style={{fontWeight: formats.includes("bold") ? 700 : undefined, fontStyle: formats.includes("italic") ? "italic" : undefined,
                        textDecoration: [formats.includes("underline") ? "underline" : "", formats.includes("strikethrough") ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
                        fontFamily: formats.includes("code") ? "monospace" : undefined}}>{text}</span>;
            }
            case "linebreak": return <br key={key} />;
            case "paragraph": return <p key={key} className="event-lexical__paragraph" style={alignment(node)}>{children}</p>;
            case "heading": {
                if (node.tag === "h1") return <h1 key={key} className="event-lexical__h1" style={alignment(node)}>{children}</h1>;
                if (node.tag === "h2") return <h2 key={key} className="event-lexical__h2" style={alignment(node)}>{children}</h2>;
                if (node.tag === "h3") return <h3 key={key} className="event-lexical__h3" style={alignment(node)}>{children}</h3>;
                return null;
            }
            case "quote": return <blockquote key={key} className="event-lexical__quote" style={alignment(node)}>{children}</blockquote>;
            case "code": return <pre key={key} className="event-lexical__code"><code>{children}</code></pre>;
            case "list": return node.listType === "number" ? <ol key={key} className="event-lexical__ol">{children}</ol>
                : node.listType === "bullet" ? <ul key={key} className="event-lexical__ul">{children}</ul> : null;
            case "listitem": return <li key={key} className="event-lexical__li">{children}</li>;
            case "link":
            case "autolink": {
                const href = safeHref(node.url);
                if (!href) return <span key={key}>{children}</span>;
                return <a key={key} className="event-lexical__link" href={href} target={href.startsWith("https://") ? "_blank" : undefined} rel={href.startsWith("https://") ? "noopener noreferrer" : undefined}>{children}</a>;
            }
            default: return null;
        }
    }
    return <div className="event-rich-text-view">{root.children.map(render)}</div>;
}
