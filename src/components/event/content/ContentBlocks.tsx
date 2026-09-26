import ReactMarkdown from "react-markdown";
import type {ContentDocument} from "@/types/eventContent";

type Value = string | number | boolean | null;

function compare(actual: Value | undefined, operator: string, expected: Value): boolean {
    if (actual === undefined || actual === null) return false;
    switch (operator) {
        case "equals": return actual === expected;
        case "not_equals": return actual !== expected;
        case "greater_than": return typeof actual === "number" && typeof expected === "number" && actual > expected;
        case "greater_or_equal": return typeof actual === "number" && typeof expected === "number" && actual >= expected;
        case "less_than": return typeof actual === "number" && typeof expected === "number" && actual < expected;
        case "less_or_equal": return typeof actual === "number" && typeof expected === "number" && actual <= expected;
        case "before": return typeof actual === "string" && typeof expected === "string" && Date.parse(actual) < Date.parse(expected);
        case "after": return typeof actual === "string" && typeof expected === "string" && Date.parse(actual) > Date.parse(expected);
        default: return false;
    }
}

const dateFormat = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});
const numberFormat = new Intl.NumberFormat("uk-UA");

function replaceVariables(text: string, variables: Record<string, Value>, declared: Map<string, string>, inMarkdown = false): string {
    return text.replace(/\{\{([a-z][a-zA-Z0-9.]*)\}\}/g, (token, name: string) => {
        const format = declared.get(name);
        if (!format) return token;
        const value = variables[name];
        if (value === undefined || value === null) return "";
        if (typeof value === "boolean") return value ? "Так" : "Ні";
        // Values come from event settings, not the Markdown author. Keep them
        // as literal text so they cannot create links or formatting on insert.
        const rendered = format === "date-time" && typeof value === "string" && !Number.isNaN(Date.parse(value))
            ? dateFormat.format(new Date(value))
            : format === "number" && typeof value === "number" ? numberFormat.format(value) : String(value);
        return inMarkdown ? rendered.replace(/[\\`*_\[\]{}()#+!>|~]/g, "\\$&") : rendered;
    });
}

export function ContentBlocks({document, variables, title}: {
    document: ContentDocument;
    variables: Record<string, Value>;
    title?: string;
}) {
    const blocks = document.blocks.filter(block => (block.visibility ?? []).every(rule =>
        compare(variables[rule.variable], rule.operator, rule.value)));
    return <div className="ib-blocks">
        {title && <section className="ib-block event-content-heading"><div className="ib-block__in"><h1 className="ib-block__title ib-block__title--page">{title}</h1></div></section>}
        {blocks.map(block => {
            const declared = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
            if (block.type === "section") return <section className="ib-block" key={block.id} id={block.id}>
                <div className="ib-block__in"><h2 className="ib-block__title">{replaceVariables(block.label ?? "", variables, declared)}</h2></div>
            </section>;
            return <section className="ib-block ib-block-text" key={block.id} id={block.id}>
                <div className="ib-block__in"><div className="ib-block-prose">
                    <ReactMarkdown>{replaceVariables(block.markdown ?? "", variables, declared, true)}</ReactMarkdown>
                </div></div>
            </section>;
        })}
        {blocks.length === 0 && <section className="ib-block"><div className="ib-block__in"><p className="event-content-empty">Організатори ще готують вміст цієї сторінки.</p></div></section>}
    </div>;
}
