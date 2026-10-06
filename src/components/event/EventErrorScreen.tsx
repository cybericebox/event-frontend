"use client";

import type {MouseEvent} from "react";
import {t} from "@/i18n/t";
import {feedbackHref} from "@/utils/feedback";
import {lastServerErrorRequestId} from "@/utils/serviceStatus";
import {ErrorPage, platformErrorCode} from "./ErrorPage";

// Browser history back; a tab opened straight on the failing page goes home instead.
export function goBack() {
    if (window.history.length > 1) window.history.back();
    // a full load leaves the failed render state behind
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    else window.location.assign("/");
}

// The «Повідомити деталі» link: the feedback mailto, prefilled when it is clicked (the page URL and the
// time are known only in the browser). An API error carries the reference number; a crash carries the
// trimmed message, the app name and the build version. No personal data beyond what the user types.
function ReportLink({ticket, message}: {ticket?: string; message: string}) {
    const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
    function fill(event: MouseEvent<HTMLAnchorElement>) {
        const common = {url: window.location.href, time: new Date().toISOString()};
        const app = t("feedback.app");
        const subject = ticket ? t("error.page.reportSubject", {ref: ticket}) : t("error.page.reportSubjectCrash", {app});
        const body = ticket
            ? t("error.page.reportBody", {...common, ref: ticket})
            : t("error.page.reportBodyCrash", {...common, message: message.slice(0, 200), app, version: process.env.NEXT_PUBLIC_APP_VERSION ?? "-"});
        event.currentTarget.href = feedbackHref(subject, body);
    }
    return <a className="ib-link" href={`mailto:${email}`} onClick={fill}>{t("error.page.report")}</a>;
}

// Error boundary screen, the error page with code 500: «Спробувати ще раз» and «Назад». Never shows error
// details on the page. `error` decides what the page says:
//   an API error (it carries a platform code or an HTTP status): the backend journaled it, so the text says the report
//   is received, and the reference «{code}-{request id, 8 chars}» (the 8 characters alone when there is no platform code) shows when the
//   request id is known (X-Request-ID; without it, the code alone);
//   anything else is a frontend crash: nothing is journaled, so no report line and no reference number.
// `page` is the full-screen mode with the footer (global error, the shell could not render); otherwise it is
// the block inside the shell's content area. A caller's own `body` wins over the default text.
export function EventErrorScreen({onRetry, title = t("error.page.title"), body, page = false, error}: {
    onRetry: () => void;
    title?: string;
    body?: string;
    page?: boolean;
    error?: unknown;
}) {
    const code = platformErrorCode(error);
    const fields = error && typeof error === "object" ? error as {status?: unknown; requestId?: unknown} : {};
    const status = fields.status;
    const fromApi = code !== undefined || (typeof status === "number" && status >= 500);
    const requestId = fromApi ? (typeof fields.requestId === "string" && fields.requestId ? fields.requestId : lastServerErrorRequestId()) : null;
    // «{platform code}-{request id, 8 chars}»; without a platform code (none, or 0) the 8 characters alone.
    const shortId = requestId ? requestId.replace(/-/g, "").slice(0, 8) : "";
    const ref = shortId ? (code ? `${code}-${shortId}` : shortId) : undefined;
    const message = error instanceof Error ? error.message : "";
    return <ErrorPage mode={page ? "page" : "block"} role="alert" code={500} title={title}
        text={body ?? (fromApi ? t("error.page.reported") : t("error.page.body"))}
        refCode={code || undefined} ticket={ref}
        report={<ReportLink ticket={ref} message={message} />}>
        <button type="button" className="ib-btn ib-btn--primary" onClick={onRetry}>{t("error.load.retry")}</button>
        <button type="button" className="ib-link" onClick={goBack}>{t("error.page.back")}</button>
    </ErrorPage>;
}
