"use client";

import {useEffect} from "react";
import Image from "next/image";
import {SearchX} from "lucide-react";
import crest from "@/styles/assets/crest-128.png";
import {BRAND_HEAD, BRAND_TAIL} from "@/i18n/brand";
import {mainOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";
import "@/styles/error-screen.css";

// The event of this address does not exist: deleted, never created, a wrong subdomain. The
// API answers 404 for an unpublished event to everyone without rights too, so the text says
// only that there is no such event. The event is unknown, so the screen carries no event
// branding: the platform crest and wordmark, whatever the layout context holds. Same frame
// as EventErrorScreen.
export function EventNotFoundScreen() {
    useEffect(() => {document.title = t("shell.missing.title");}, []);
    return <MissingEvent />;
}

function MissingEvent() {
    return <main className="event-error event-error--page" role="alert">
        <Image className="event-error__logo" src={crest} width={64} height={64} alt="" loading="eager" />
        <p className="event-error__brand">{BRAND_HEAD}<span className="event-error__ice">ICE</span>{BRAND_TAIL}</p>
        <SearchX className="event-error__mark event-error__mark--muted" aria-hidden="true" />
        <h1>{t("shell.missing.title")}</h1>
        <p>{t("shell.missing.body")}</p>
        <div className="event-error__actions">
            <a className="ib-btn" href={mainOrigin || "/"}>{t("shell.missing.home")}</a>
        </div>
    </main>;
}
