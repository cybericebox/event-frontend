import type {CSSProperties} from "react";
import type {ContentBlock, ContentDocument} from "@/types/eventContent";
import {EventRichTextView} from "./EventRichTextView";
import {CountdownValue} from "./CountdownDisplay";
import {ProportionalBannerImage} from "./ProportionalBannerImage";
import {formatDateTime} from "./dateDisplay";
import {ActionBlock, type PreviewViewer} from "./ActionBlock";
import {PartnersBlock} from "./PartnersBlock";
import {CountdownWindow} from "./CountdownWindow";

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

// The element id links target (#anchor, /slug#anchor); blocks without an
// anchor keep their generated id.
export function blockElementID(block: ContentBlock): string {
    return block.anchor?.trim() || block.id;
}

// The page title is not shown on the page: the first block heading becomes the h1.
function headingBlockID(blocks: ContentBlock[], coverImage: string | undefined): string | undefined {
    return blocks.find(block => {
        switch (block.type) {
            case "banner": return !!block.title && !!bannerImageURL(block.imageSource === "custom" ? block.imageURL : coverImage);
            case "hero": case "section": return true;
            case "doc": case "facts": case "timeline": case "faq": case "cta": case "countdown": case "partners": return !!block.title;
            default: return false;
        }
    })?.id;
}

export function contentImageURL(source: string | undefined): string | undefined {
    return bannerImageURL(source);
}

function bannerImageURL(source: string | undefined): string | undefined {
    if (!source) return undefined;
    if (source.startsWith("/api/events/") && process.env.NEXT_PUBLIC_DOMAIN) {
        const version = source.includes("/content-images/") ? "?v=2" : "";
        return `https://api.${process.env.NEXT_PUBLIC_DOMAIN}${source}${version}`;
    }
    return source;
}

// `title` is never shown: it is a visually hidden h1 used only when no block has a heading.
export function ContentBlocks({document, variables, title, selectedBlockId, coverImage, eventID, preview, previewViewer}: {
    document: ContentDocument;
    variables: Record<string, Value>;
    title?: string;
    selectedBlockId?: string;
    coverImage?: string;
    eventID?: string;
    preview?: boolean;
    previewViewer?: PreviewViewer;
}) {
    const blocks = document.blocks.filter(block => contentBlockVisible(block, variables));
    const primaryID = headingBlockID(blocks, coverImage);
    return <div className="ib-blocks">
        {!primaryID && title && <h1 className="ib-visually-hidden">{title}</h1>}
        {blocks.map((block, blockIndex) => {
            const Heading = block.id === primaryID ? "h1" : "h2";
            const declared = new Map((block.variables ?? []).map(variable => [variable.name, variable.format]));
            const render = (value = "", field = "") => replaceVariables(value, variables, declared, false, block.dateDisplays?.[field]);
            const heading = block.title || block.sub ? <div className="ib-block__head">
                {block.title && <Heading className="ib-block__title">{render(block.title, "title")}</Heading>}
                {block.sub && <p className="ib-block__sub">{render(block.sub, "sub")}</p>}
            </div> : null;
            if (block.type === "banner") {
                const imageURL = bannerImageURL(block.imageSource === "custom" ? block.imageURL : coverImage);
                return <section className={`ib-block ib-block-banner${block.variant === "frame" ? " ib-block-banner--frame" : ""}${block.layout === "center" ? " ib-block-banner--caption-center" : block.layout === "right" ? " ib-block-banner--caption-right" : ""}`} key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block-banner__inner" style={{"--ib-banner-width": `${block.widthPercent ?? 100}%`} as CSSProperties}>
                    {imageURL ? <ProportionalBannerImage src={imageURL} alt={render(block.title, "title") || "Банер події"} eager={blockIndex === 0} /> : <div className="ib-block-banner__placeholder"><strong>{render(block.title, "title") || String(variables["event.name"] ?? "")}</strong></div>}
                    {imageURL && block.title && <div className="ib-block-banner__caption"><Heading>{render(block.title, "title")}</Heading></div>}
                </div>
            </section>;
            }
            if (block.type === "hero") {
                const target = block.targetDate || variables[block.targetVariable ?? ""];
                const mass = block.variant === "mass";
                return <section className={`ib-block ib-block-hero${mass ? " ib-mass ib-mass-waves" : ""}${block.layout === "center" ? " ib-block-hero--center" : ""}${block.timerSize !== "large" ? " ib-block-hero--timer-xl" : ""}`} key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}>
                    <div className="ib-block__in">
                        {block.by && <p className="ib-block-hero__by">{render(block.by, "by")}</p>}
                        {block.kicker && <span className="ib-block-hero__kicker">{render(block.kicker, "kicker")}</span>}
                        <Heading className="ib-block-hero__title">{render(block.title, "title")}</Heading>
                        <div className="ib-block-hero__row">
                            <dl className="ib-block-hero__facts">{(block.items ?? []).map((item, index) => <div key={index}><dt>{render(item.label, `item:${index}:label`)}</dt><dd>{render(item.value, `item:${index}:value`)}</dd></div>)}</dl>
                            <div className="ib-block-hero__aside">
                                {(block.targetVariable || block.targetDate) && <CountdownValue target={typeof target === "string" ? target : null} display={block.timerDisplay} />}
                                {block.note && <p className="ib-block-hero__note">{render(block.note, "note")}</p>}
                            </div>
                        </div>
                    </div>
                </section>;
            }
            if (block.type === "section") return <section className={`ib-block${block.variant === "center" ? " ib-block-section--center" : block.variant === "right" ? " ib-block-section--right" : block.variant === "justify" ? " ib-block-section--justify" : ""}`} key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block__in"><Heading className="ib-block__title">{render(block.label, "label")}</Heading></div>
            </section>;
            if (block.type === "text") return <section className={`ib-block ib-block-text${block.variant === "wide" ? " ib-block-text--wide" : ""}`} key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block__in"><div className="ib-block-prose">
                    <EventRichTextView value={block.richText} variables={variables} dateDisplays={block.dateDisplays?.richText} />
                </div></div>
            </section>;
            if (block.type === "doc") return <section className="ib-block ib-block-doc" key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}>
                <div className="ib-block__in">{heading}<div className="ib-block-doc__grid">
                    <article className="ib-block-prose">{(block.items ?? []).map((item, index) => {
                        const sectionID = `doc-${blockIndex}-${index}`;
                        return <section key={sectionID} aria-labelledby={sectionID}><h3 id={sectionID}>{render(item.label, `item:${index}:label`)}</h3><EventRichTextView value={item.richText} variables={variables} dateDisplays={block.dateDisplays?.[`item:${index}:richText`]} /></section>;
                    })}</article>
                    <nav className="ib-toc" aria-label={render(block.tocTitle || "Зміст", "tocTitle")}><p className="ib-toc__title">{render(block.tocTitle || "Зміст", "tocTitle")}</p><ol className="ib-toc__list">{(block.items ?? []).map((item, index) => <li key={index}><a className="ib-toc__link" href={`#doc-${blockIndex}-${index}`}>{render(item.label, `item:${index}:label`)}</a></li>)}</ol></nav>
                </div></div>
            </section>;
            if (block.type === "facts") return <section className={`ib-block ib-block-facts${block.variant === "rows" ? " ib-block-facts--rows" : ""}`} key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in">{heading}<dl className="ib-block-facts__list">{(block.items ?? []).map((item, index) => <div className="ib-block-facts__item" key={index}><dt>{render(item.label, `item:${index}:label`)}</dt><dd>{render(item.value, `item:${index}:value`)}</dd></div>)}</dl></div></section>;
            if (block.type === "timeline") return <section className={`ib-block ib-block-timeline${block.variant === "list" ? " ib-block-timeline--list" : ""}`} key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in">{heading}<ol className="ib-block-timeline__list">{(block.items ?? []).map((item, index) => <li className="ib-block-timeline__step" key={index}><time className="ib-block-timeline__time" dateTime={item.dateSource === "custom" ? item.dateValue : String(variables[item.dateVariable ?? ""] ?? "")}>{formatDateTime(item.dateSource === "custom" ? item.dateValue ?? "" : String(variables[item.dateVariable ?? ""] ?? ""), item.dateFormat, item.datePattern)}</time><p className="ib-block-timeline__label">{render(item.value, `item:${index}:value`)}</p></li>)}</ol></div></section>;
            if (block.type === "faq") return <section className="ib-block ib-block-faq" key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in">{heading}<div className="ib-accordion ib-accordion--lg">{(block.items ?? []).map((item, index) => <details className="ib-accordion__item" key={index} open={index === block.openItem}><summary className="ib-accordion__q">{render(item.label, `item:${index}:label`)}</summary><div className="ib-accordion__a ib-block-prose"><EventRichTextView value={item.richText} variables={variables} dateDisplays={block.dateDisplays?.[`item:${index}:richText`]} /></div></details>)}</div></div></section>;
            if (block.type === "cta") {
                return <ActionBlock key={block.id} id={blockElementID(block)} title={render(block.title, "title")} text={render(block.text, "text")} variant={block.variant} alignment={block.actionAlignment} selected={selectedBlockId === block.id} primaryHeading={block.id === primaryID} preview={preview} previewViewer={previewViewer} actions={[block.action, block.secondaryAction].filter(action => !!action).map(action => ({label: render(action.label, action === block.action ? "action:label" : "secondaryAction:label"), kind: action.kind, href: render(action.href, action === block.action ? "action:href" : "secondaryAction:href")}))} registrationOpen={variables["event.registrationOpen"] === true} joinPolicy={String(variables["event.joinPolicy"] ?? "")} startAt={String(variables["event.startAt"] ?? "")} finishAt={String(variables["event.effectiveFinishAt"] ?? "")} eventID={eventID ?? ""} eventTag={String(variables["event.tag"] ?? "")} />;
            }
            if (block.type === "countdown") {
                const target = block.targetDate || variables[block.targetVariable ?? ""];
                const showFrom = block.showFromSource === "custom" ? block.showFromDate : block.showFromSource === "event" ? variables[block.showFromVariable ?? ""] : null;
                return <CountdownWindow key={block.id} showFrom={typeof showFrom === "string" ? showFrom : null} target={typeof target === "string" ? target : null} hideAfterFinish={block.hideAfterFinish}><section className={`ib-block ib-block-countdown${block.variant === "center" ? " ib-block-countdown--center" : ""}${!block.title && !block.text ? " ib-block-countdown--timer-only" : ""}${block.timerSize === "xl" ? " ib-block-countdown--timer-xl" : ""}${block.surface === "frame" ? " ib-block-countdown--frame" : ""} ib-block-countdown--text-${block.verticalAlignment ?? "center"}`} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in"><div>{block.title && <Heading className="ib-block-countdown__title">{render(block.title, "title")}</Heading>}{block.text && <p className="ib-block-countdown__text">{render(block.text, "text")}</p>}</div><div className="ib-block-countdown__side"><CountdownValue target={typeof target === "string" ? target : null} display={block.timerDisplay} /></div></div></section></CountdownWindow>;
            }
            if (block.type === "partners") return <PartnersBlock key={block.id} id={blockElementID(block)} selected={selectedBlockId === block.id} heading={heading} text={render(block.text, "text")} groups={(block.groups ?? []).map((group, groupIndex) => ({
                title: render(group.title, `group:${groupIndex}:title`),
                items: group.items.map(logo => ({name: render(logo.name), imageURL: bannerImageURL(logo.imageURL) ?? "", href: logo.href})),
            }))} />;
            if (block.type === "divider") return <section className={`ib-block ib-block-divider${block.size === "sm" ? " ib-block-divider--sm" : block.size === "lg" ? " ib-block-divider--lg" : ""}${block.line ? " ib-block-divider--line" : ""}`} key={block.id} id={blockElementID(block)} data-preview-selected={selectedBlockId === block.id || undefined}><div className="ib-block__in" /></section>;
            return null;
        })}
    </div>;
}
