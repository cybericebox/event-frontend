"use client";

import {Fragment, type ReactNode} from "react";
import Image from "next/image";
import crest from "@/styles/assets/crest-128.png";
import {BRAND} from "@/i18n/brand";
import {mainOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";
import {FeedbackLink} from "@/components/FeedbackLink";
import {EventBrandLogo, useEventBrandName} from "./EventBrandLogo";
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
export function ErrorPage({mode, code, title, text, children, refCode, role, platformBrand = false, homeHref}: {
    mode: "page" | "block";
    code: number;
    title: string | [string, string];
    text?: ReactNode;
    children?: ReactNode;
    refCode?: number;
    role?: "alert";
    platformBrand?: boolean;
    homeHref?: string;
}) {
    const lines = typeof title === "string" ? title : title.map((line, i) => <Fragment key={line}>{i > 0 && " "}<span className="ib-error__line">{line}</span></Fragment>);
    const Heading = mode === "page" ? "h1" : "h2";
    const column = <>
        <p className="ib-error__code" aria-hidden="true">{code}</p>
        <Heading className="ib-error__title">{lines}</Heading>
        {text && <p className="ib-error__text">{text}</p>}
        {children && <div className="ib-error__actions">{children}</div>}
        {refCode !== undefined && <p className="ib-error__ref">{t("error.load.code", {code: refCode})}</p>}
    </>;
    if (mode === "block") return <div className="ib-error ib-error--block" role={role}><div className="ib-error__main">{column}</div></div>;
    return <div className="ib-error ib-error--page" role={role}>
        <main className="ib-error__main" id="main" tabIndex={-1}>{column}</main>
        <ErrorFooter platformBrand={platformBrand} homeHref={homeHref} />
    </div>;
}

function ErrorFooter({platformBrand, homeHref}: {platformBrand: boolean; homeHref?: string}) {
    const eventName = useEventBrandName();
    const event = !platformBrand && !!eventName;
    const home = homeHref ?? (event ? "/" : mainOrigin || "/");
    const brand = <>
        {event
            ? <EventBrandLogo size={18} />
            : <Image src={crest} width={18} height={18} alt="" loading="eager" />}
        {event ? eventName : BRAND}
    </>;
    return <footer className="ib-error__footer">
        <a className="ib-error__brand" href={home}>{brand}</a>
        <nav className="ib-error__links" aria-label={t("error.page.links")}>
            <a href={home}>{t("error.goHome")}</a>
            <FeedbackLink />
        </nav>
    </footer>;
}
