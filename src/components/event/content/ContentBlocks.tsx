import type {CSSProperties} from "react";
import type {ContentBlock, ContentDocument} from "@/types/eventContent";
import {AlignedMarkdown} from "./AlignedMarkdown";
import {CountdownValue} from "./CountdownValue";
import {ProportionalBannerImage} from "./ProportionalBannerImage";
import {formatDateTime} from "./dateDisplay";

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

export function contentBlockVisible(block: ContentBlock, variables: Record<string, Value>): boolean {
    return (block.visibility ?? []).every(rule => compare(variables[rule.variable], rule.operator, rule.value));
}

const numberFormat = new Intl.NumberFormat("uk-UA");

export function replaceVariables(text: string, variables: Record<string, Value>, declared: Map<string, string>, inMarkdown = false, dateDisplays?: Record<string, {format: "date-time" | "date" | "time" | "short" | "custom"; pattern?: string}>): string {
    return text.replace(/\{\{([a-z][a-zA-Z0-9.]*)\}\}/g, (token, name: string) => {
        const format = declared.get(name);
        if (!format) return token;
        const value = variables[name];
        if (value === undefined || value === null) return "";
        if (typeof value === "boolean") return value ? "Так" : "Ні";
        // Values come from event settings, not the Markdown author. Keep them
        // as literal text so they cannot create links or formatting on insert.
        const rendered = format === "date-time" && typeof value === "string" && !Number.isNaN(Date.parse(value))
            ? formatDateTime(value, dateDisplays?.[name]?.format, dateDisplays?.[name]?.pattern)
            : format === "number" && typeof value === "number" ? numberFormat.format(value) : String(value);
        return inMarkdown ? rendered.replace(/[\\`*_\[\]{}()#+!>|~]/g, "\\$&") : rendered;
    });
}

function safeHref(href: string): string | undefined {
    if (!href || /[\\\r\n\t]/.test(href) || href.startsWith("//")) return undefined;
    if (href.startsWith("/") && !href.startsWith("//")) return href;
    if (href.startsWith("#")) return href;
    try { const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}

function bannerImageURL(source: string | undefined): string | undefined {
    if (!source) return undefined;
    if (source.startsWith("/api/events/") && process.env.NEXT_PUBLIC_DOMAIN) {
        const version = source.includes("/content-images/") ? "?v=2" : "";
        return `https://api.${process.env.NEXT_PUBLIC_DOMAIN}${source}${version}`;
    }
    return source;
}

export function ContentBlocks({document, variables, title, selectedBlockId, coverImage}: {
    document: ContentDocument;
    variables: Record<string, Value>;
    title?: string;
    selectedBlockId?: string;
    coverImage?: string;
}) {
    const blocks = document.blocks.filter(block => contentBlockVisible(block, variables));
    return <div className="ib-blocks">
        {title && <section className="ib-block event-content-heading"><div className="ib-block__in"><h1 className="ib-block__title ib-block__title--page">{title}</h1></div></section>}
        {blocks.map((block, blockIndex) => {
            const declared = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
            const render = (value = "", field = "") => replaceVariables(value, variables, declared, false, block.dateDisplays?.[field]);
            const renderMarkdown = (value: string, field: string) => replaceVariables(value, variables, declared, true, block.dateDisplays?.[field]);
            const heading = block.title || block.sub ? <div className="ib-block__head">
                {block.title && <h2 className="ib-block__title">{render(block.title, "title")}</h2>}
                {block.sub && <p className="ib-block__sub">{render(block.sub, "sub")}</p>}
            </div> : null;
            if (block.type === "banner") {
                const imageURL = bannerImageURL(block.imageSource === "custom" ? block.imageURL : coverImage);
                return <section className={`ib-block ib-block-banner${block.variant === "frame" ? " ib-block-banner--frame" : ""}${block.layout === "center" ? " ib-block-banner--caption-center" : block.layout === "right" ? " ib-block-banner--caption-right" : ""}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block-banner__inner" style={{"--ib-banner-width": `${block.widthPercent ?? 100}%`} as CSSProperties}>
                    {imageURL ? <ProportionalBannerImage src={imageURL} alt={render(block.title, "title") || "Банер події"} /> : <div className="ib-block-banner__placeholder"><strong>{render(block.title, "title") || String(variables["event.name"] ?? "")}</strong></div>}
                    {imageURL && block.title && <div className="ib-block-banner__caption"><h2>{render(block.title, "title")}</h2></div>}
                </div>
            </section>;
            }
            if (block.type === "hero") {
                const target = block.targetDate || variables[block.targetVariable ?? ""];
                const primaryHref = safeHref(render(block.action?.href));
                const secondaryHref = safeHref(render(block.secondaryAction?.href));
                const mass = block.variant === "mass";
                return <section className={`ib-block ib-block-hero${mass ? " ib-mass ib-mass-waves" : ""}${block.layout === "center" ? " ib-block-hero--center" : ""}${block.timerSize !== "large" ? " ib-block-hero--timer-xl" : ""}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}>
                    <div className="ib-block__in">
                        {block.by && <p className="ib-block-hero__by">{render(block.by, "by")}</p>}
                        {block.kicker && <span className="ib-block-hero__kicker">{render(block.kicker, "kicker")}</span>}
                        {title ? <h2 className="ib-block-hero__title">{render(block.title, "title")}</h2> : <h1 className="ib-block-hero__title">{render(block.title, "title")}</h1>}
                        <div className="ib-block-hero__row">
                            <dl className="ib-block-hero__facts">{(block.items ?? []).map((item, index) => <div key={index}><dt>{render(item.label, `item:${index}:label`)}</dt><dd>{render(item.value, `item:${index}:value`)}</dd></div>)}</dl>
                            <div className="ib-block-hero__aside">
                                {(block.targetVariable || block.targetDate) && <CountdownValue target={typeof target === "string" ? target : null} display={block.timerDisplay} />}
                                <div className={`ib-block-hero__cta ib-block-hero__cta--${block.actionAlignment ?? "end"}`}>
                                    {primaryHref && block.action?.label && <a className={`ib-btn ${mass ? "ib-btn--mass" : "ib-btn--primary"}`} href={primaryHref}>{render(block.action.label, "action:label")}</a>}
                                    {secondaryHref && block.secondaryAction?.label && <a className={`ib-btn${mass ? " ib-btn--mass-outline" : ""}`} href={secondaryHref}>{render(block.secondaryAction.label, "secondaryAction:label")}</a>}
                                </div>
                                {block.note && <p className="ib-block-hero__note">{render(block.note, "note")}</p>}
                            </div>
                        </div>
                    </div>
                </section>;
            }
            if (block.type === "section") return <section className={`ib-block${block.variant === "center" ? " ib-block-section--center" : block.variant === "right" ? " ib-block-section--right" : block.variant === "justify" ? " ib-block-section--justify" : ""}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block__in"><h2 className="ib-block__title">{render(block.label, "label")}</h2></div>
            </section>;
            if (block.type === "text") return <section className={`ib-block ib-block-text${block.variant === "wide" ? " ib-block-text--wide" : ""}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block__in"><div className="ib-block-prose">
                    <AlignedMarkdown>{renderMarkdown(block.markdown ?? "", "markdown")}</AlignedMarkdown>
                </div></div>
            </section>;
            if (block.type === "doc") return <section className="ib-block ib-block-doc" key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block__in">{heading}<div className="ib-block-doc__grid">
                    <article className="ib-block-prose">{(block.items ?? []).map((item, index) => {
                        const sectionID = `doc-${blockIndex}-${index}`;
                        return <section key={sectionID} aria-labelledby={sectionID}><h3 id={sectionID}>{render(item.label, `item:${index}:label`)}</h3><AlignedMarkdown>{renderMarkdown(item.value ?? "", `item:${index}:value`)}</AlignedMarkdown></section>;
                    })}</article>
                    <nav className="ib-toc" aria-label={render(block.tocTitle || "Зміст", "tocTitle")}><p className="ib-toc__title">{render(block.tocTitle || "Зміст", "tocTitle")}</p><ol className="ib-toc__list">{(block.items ?? []).map((item, index) => <li key={index}><a className="ib-toc__link" href={`#doc-${blockIndex}-${index}`}>{render(item.label, `item:${index}:label`)}</a></li>)}</ol></nav>
                </div></div>
            </section>;
            if (block.type === "facts") return <section className={`ib-block ib-block-facts${block.variant === "rows" ? " ib-block-facts--rows" : ""}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in">{heading}<dl className="ib-block-facts__list">{(block.items ?? []).map((item, index) => <div className="ib-block-facts__item" key={index}><dt>{render(item.label, `item:${index}:label`)}</dt><dd>{render(item.value, `item:${index}:value`)}</dd></div>)}</dl></div></section>;
            if (block.type === "timeline") return <section className={`ib-block ib-block-timeline${block.variant === "list" ? " ib-block-timeline--list" : ""}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in">{heading}<ol className="ib-block-timeline__list">{(block.items ?? []).map((item, index) => <li className="ib-block-timeline__step" key={index}><time className="ib-block-timeline__time" dateTime={item.dateSource === "custom" ? item.dateValue : String(variables[item.dateVariable ?? ""] ?? "")}>{formatDateTime(item.dateSource === "custom" ? item.dateValue ?? "" : String(variables[item.dateVariable ?? ""] ?? ""), item.dateFormat, item.datePattern)}</time><p className="ib-block-timeline__label">{render(item.value, `item:${index}:value`)}</p></li>)}</ol></div></section>;
            if (block.type === "faq") return <section className="ib-block ib-block-faq" key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in">{heading}<div className="ib-accordion ib-accordion--lg">{(block.items ?? []).map((item, index) => <details className="ib-accordion__item" key={index} open={index === block.openItem}><summary className="ib-accordion__q">{render(item.label, `item:${index}:label`)}</summary><div className="ib-accordion__a ib-block-prose"><AlignedMarkdown>{renderMarkdown(item.value ?? "", `item:${index}:value`)}</AlignedMarkdown></div></details>)}</div></div></section>;
            if (block.type === "cta") {
                const href = safeHref(render(block.action?.href));
                const secondaryHref = safeHref(render(block.secondaryAction?.href));
                return <section className={`ib-block ib-block-cta${block.variant === "mass" ? " ib-mass ib-mass-waves" : ""} ib-block-cta--actions-${block.actionAlignment ?? "end"}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in"><div><h2 className="ib-block-cta__title">{render(block.title, "title")}</h2>{block.text && <p className="ib-block-cta__text">{render(block.text, "text")}</p>}</div><div className="ib-block-cta__acts">{href && block.action?.label && <a className={`ib-btn ${block.variant === "mass" ? "ib-btn--mass" : "ib-btn--primary"}`} href={href}>{render(block.action.label, "action:label")}</a>}{secondaryHref && block.secondaryAction?.label && <a className={`ib-btn${block.variant === "mass" ? " ib-btn--mass-outline" : ""}`} href={secondaryHref}>{render(block.secondaryAction.label, "secondaryAction:label")}</a>}</div></div></section>;
            }
            if (block.type === "countdown") {
                const target = block.targetDate || variables[block.targetVariable ?? ""];
                const actionHref = safeHref(render(block.action?.href));
                return <section className={`ib-block ib-block-countdown${block.variant === "center" ? " ib-block-countdown--center" : ""}${!block.title && !block.text ? " ib-block-countdown--timer-only" : ""}${block.timerSize === "xl" ? " ib-block-countdown--timer-xl" : ""}${block.surface === "frame" ? " ib-block-countdown--frame" : ""} ib-block-countdown--text-${block.verticalAlignment ?? "center"} ib-block-countdown--actions-${block.actionAlignment ?? "end"}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in"><div>{block.title && <h2 className="ib-block-countdown__title">{render(block.title, "title")}</h2>}{block.text && <p className="ib-block-countdown__text">{render(block.text, "text")}</p>}</div><div className="ib-block-countdown__side"><CountdownValue target={typeof target === "string" ? target : null} display={block.timerDisplay} />{actionHref && block.action?.label && <a className="ib-btn ib-btn--primary" href={actionHref}>{render(block.action.label, "action:label")}</a>}</div></div></section>;
            }
            return <section className={`ib-block ib-block-divider${block.size === "sm" ? " ib-block-divider--sm" : block.size === "lg" ? " ib-block-divider--lg" : ""}${block.line ? " ib-block-divider--line" : ""}`} key={block.id} id={block.id} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in" /></section>;
        })}
    </div>;
}
