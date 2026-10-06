import type {ReactNode} from "react";
import Image from "next/image";
import {EventTooltip} from "@/components/ui/EventTooltip";

type Logo = {name: string; imageURL: string; href?: string};

function safeHref(href: string | undefined): string | undefined {
    if (!href || /[\\\r\n\t]/.test(href) || href.startsWith("//")) return undefined;
    if (href.startsWith("/") || href.startsWith("#")) return href;
    try { const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}

// Block «Партнери» (ds-v2 patterns/blocks/partners): named groups of logos,
// one height and one tone for every logo; a logo may link to its site.
export function PartnersBlock({id, selected, heading, text, groups}: {
    id: string;
    selected?: boolean;
    heading: ReactNode;
    text: string;
    groups: {title: string; items: Logo[]}[];
}) {
    return <section className="ib-block ib-block-partners" id={id} data-preview-selected={selected || undefined}>
        <div className="ib-block__in">
            {heading}
            {text && <p className="ib-block-partners__text">{text}</p>}
            {groups.map((group, groupIndex) => <div className="ib-block-partners__group" key={groupIndex}>
                {group.title && <p className="ib-block-partners__label">{group.title}</p>}
                <ul className="ib-block-partners__grid">{group.items.map((logo, logoIndex) => {
                    const href = safeHref(logo.href);
                    const image = logo.imageURL
                        ? <Image className="ib-block-partners__image" src={logo.imageURL} alt={logo.name} width={160} height={40} unoptimized />
                        : <span className="ib-block-partners__name">{logo.name}</span>;
                    const tile = href
                        ? <a className="ib-block-partners__logo" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>{image}</a>
                        : <span className="ib-block-partners__logo">{image}</span>;
                    // An image logo names the partner only through alt text, so the hint shows the name.
                    return <li key={logoIndex}>{logo.imageURL ? <EventTooltip content={logo.name} className="ib-block-partners__tip" silent>{() => tile}</EventTooltip> : tile}</li>;
                })}</ul>
            </div>)}
        </div>
    </section>;
}
