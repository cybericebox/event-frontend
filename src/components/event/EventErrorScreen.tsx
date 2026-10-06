"use client";

import {t} from "@/i18n/t";
import {ErrorPage, platformErrorCode} from "./ErrorPage";

// Browser history back; a tab opened straight on the failing page goes home instead.
export function goBack() {
    if (window.history.length > 1) window.history.back();
    // a full load leaves the failed render state behind
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    else window.location.assign("/");
}

// Error boundary screen, the error page with code 500: «Оновити» and «Назад». Never shows error
// details; `error` only supplies the platform code for the «Код помилки» line. `page` is the
// full-screen mode with the footer (global error, the shell could not render); otherwise it is the
// block inside the shell's content area.
export function EventErrorScreen({onRetry, title = t("error.page.title"), body = t("error.page.body"), page = false, error}: {
    onRetry: () => void;
    title?: string;
    body?: string;
    page?: boolean;
    error?: unknown;
}) {
    return <ErrorPage mode={page ? "page" : "block"} role="alert" code={500} title={title} text={body} refCode={platformErrorCode(error)}>
        <button type="button" className="ib-btn ib-btn--primary" onClick={onRetry}>{t("error.page.reload")}</button>
        <button type="button" className="ib-link" onClick={goBack}>{t("error.page.back")}</button>
    </ErrorPage>;
}
