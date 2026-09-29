"use client";

import {TriangleAlert} from "lucide-react";
import {EventBrandLogo} from "./EventBrandLogo";
import {t} from "@/i18n/t";
import "@/styles/error-screen.css";

// Browser history back; a tab opened straight on the failing page goes home instead.
export function goBack() {
    if (window.history.length > 1) window.history.back();
    // a full load leaves the failed render state behind
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    else window.location.assign("/");
}

// Error boundary screen in the event branding: the event logo (crest fallback when the
// event is unknown), warning mark, «Оновити» and «Назад». Never shows error details.
// `page` fills the viewport (global error, unavailable event); otherwise it centers in
// the shell's content area.
export function EventErrorScreen({onRetry, title = t("error.page.title"), body = t("error.page.body"), page = false}: {
    onRetry: () => void;
    title?: string;
    body?: string;
    page?: boolean;
}) {
    return <main className={page ? "event-error event-error--page" : "event-error"} role="alert">
        <EventBrandLogo className="event-error__logo" size={64} />
        <TriangleAlert className="event-error__mark" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="event-error__actions">
            <button type="button" className="ib-btn ib-btn--primary" onClick={onRetry}>{t("error.page.reload")}</button>
            <button type="button" className="ib-btn" onClick={goBack}>{t("error.page.back")}</button>
        </div>
    </main>;
}
