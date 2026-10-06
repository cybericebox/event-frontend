"use client";

import Link from "next/link";
import {SearchX} from "lucide-react";
import {BRAND_HEAD, BRAND_TAIL} from "@/i18n/brand";
import {t} from "@/i18n/t";
import {EventBrandLogo, useEventBrandName} from "./EventBrandLogo";
import {goBack} from "./EventErrorScreen";
import "@/styles/error-screen.css";

// «Page not found» inside this site, the same screen as in every frontend: the event logo
// and name (the crest and the wordmark when the event is unknown), muted SearchX mark,
// title, one line, «На головну» (the event home) and «Назад». A missing or unavailable
// EVENT is EventUnavailableScreen. `block` centers it in its content area, as the shell keeps
// the navbar; without it the screen fills the viewport.
export function NotFoundScreen({title = t("error.notFound"), body = t("error.notFoundDescription"), block = false}: {
    title?: string;
    body?: string;
    block?: boolean;
}) {
    const eventName = useEventBrandName();
    // `block` sits inside the shell's <main>; the full-page variant is the main itself.
    const Frame = block ? "div" : "main";
    return <Frame className={block ? "event-error" : "event-error event-error--page"}>
        <EventBrandLogo className="event-error__logo" size={64} />
        {eventName
            ? <p className="event-error__name">{eventName}</p>
            : <p className="event-error__brand">{BRAND_HEAD}<span className="event-error__ice">ICE</span>{BRAND_TAIL}</p>}
        <SearchX className="event-error__mark event-error__mark--muted" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="event-error__actions">
            <Link className="ib-btn ib-btn--primary" href="/">{t("error.goHome")}</Link>
            <button type="button" className="ib-btn" onClick={goBack}>{t("error.page.back")}</button>
        </div>
    </Frame>;
}
