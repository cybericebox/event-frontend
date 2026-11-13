"use client";

import {Fragment, useState, type ReactNode} from "react";
import Image from "next/image";
import {Copy} from "lucide-react";
import crest from "@/styles/assets/crest-128.png";
import {BRAND} from "@/i18n/brand";
import {t} from "@/i18n/t";
import {FeedbackLink} from "@/components/FeedbackLink";
import {EventBrandLogo, useEventBrandName, useEventBrandUnknown} from "./EventBrandLogo";
import "@/styles/error-page.css";

// The platform error code an API error carries (its numeric Status.Code, not the HTTP status).
export function platformErrorCode(error: unknown): number | undefined {
    const code = error && typeof error === "object" ? (error as {code?: unknown}).code : undefined;
    return typeof code === "number" ? code : undefined;
}

// The one layout of every error and not-found state (DS error-page): a big muted status code, a title
// (two lines when `title` is a pair), one line, the actions and, for an error that carries a platform
// code, the faint «Код помилки» line.
//   page:  the app shell could not render; centered in the viewport with the thin footer. The footer
//          brand is the event logo and name when the event is known, the platform crest otherwise
//          (`platformBrand` forces the crest: the screen must not reveal an event).
//   block: the shell is already there and only the content failed; the column alone, no footer.
// A link to the main site (NEXT_PUBLIC_MAIN_SITE_URL, installation settings): shown only when that site is set (src/styles/cfg.css).
// Without it the page has no "home" to lead to: `/` of this site would be the page itself (an unknown or hidden event).
export function MainSiteLink({className, children}: {className?: string; children: ReactNode}) {
    return <a className={className ? `${className} cfg-main-only` : "cfg-main-only"} href={process.env.NEXT_PUBLIC_MAIN_SITE_URL}>{children}</a>;
}

export function ErrorPage({mode, code, title, text, children, refCode, ticket, report, role, platformBrand = false, homeHref, platformHome = false}: {
    mode: "page" | "block";
    code: number;
    title: string | [string, string];
    text?: ReactNode;
    children?: ReactNode;
    refCode?: number;
    ticket?: string;
    report?: ReactNode;
    role?: "alert";
    platformBrand?: boolean;
    // An explicit target (a page where `/` is a different page). Without it: `/` on a page of a known event, the main site otherwise.
    homeHref?: string;
    // The caller's own "home" action leads to the main site and is already decided by it; the footer follows it even on an event page.
    platformHome?: boolean;
}) {
    const lines = typeof title === "string" ? title : title.map((line, i) => <Fragment key={line}>{i > 0 && " "}<span className="ib-error__line">{line}</span></Fragment>);
    const Heading = mode === "page" ? "h1" : "h2";
    const column = <>
        <p className="ib-error__code" aria-hidden="true">{code}</p>
        <Heading className="ib-error__title">{lines}</Heading>
        {text && <p className="ib-error__text">{text}</p>}
        {children && <div className="ib-error__actions">{children}</div>}
        {ticket
            ? <Ticket value={ticket} />
            : refCode !== undefined && <p className="ib-error__ref">{t("error.load.code", {code: refCode})}</p>}
        {report}
    </>;
    if (mode === "block") return <div className="ib-error ib-error--block" role={role}><div className="ib-error__main">{column}</div></div>;
    return <div className="ib-error ib-error--page" role={role}>
        <main className="ib-error__main" id="main" tabIndex={-1}>{column}</main>
        <ErrorFooter platformBrand={platformBrand} homeHref={homeHref} platformHome={platformHome} />
    </div>;
}

// «Номер звернення» with a small copy button; the result is announced through a live region.
function Ticket({value}: {value: string}) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }
    return <p className="ib-error__ref">
        {t("error.page.ticket", {ref: value})}
        {" "}
        <button type="button" className="ib-link" aria-label={t("error.page.copy")} onClick={() => void copy()}><Copy size={12} aria-hidden="true" /></button>
        <span role="status" aria-live="polite">{copied ? t("error.page.copied") : ""}</span>
    </p>;
}

function ErrorFooter({platformBrand, homeHref, platformHome}: {platformBrand: boolean; homeHref?: string; platformHome: boolean}) {
    const eventName = useEventBrandName();
    const event = !platformBrand && !!eventName;
    const unknown = useEventBrandUnknown();
    // The main site, or nowhere: the brand is then plain text and "home" is hidden.
    const toMainSite = homeHref === undefined && (platformHome || !event);
    const home = homeHref ?? "/";
    const brand = <>
        {event || (!platformBrand && unknown)
            ? <EventBrandLogo size={18} />
            : <Image src={crest} width={18} height={18} alt="" loading="eager" />}
        {event ? eventName : BRAND}
    </>;
    return <footer className="ib-error__footer">
        {toMainSite
            ? <><MainSiteLink className="ib-error__brand">{brand}</MainSiteLink><span className="ib-error__brand cfg-main-off">{brand}</span></>
            : <a className="ib-error__brand" href={home}>{brand}</a>}
        <nav className="ib-error__links" aria-label={t("error.page.links")}>
            {toMainSite ? <MainSiteLink>{t("error.goHome")}</MainSiteLink> : <a href={home}>{t("error.goHome")}</a>}
            <FeedbackLink />
        </nav>
    </footer>;
}
