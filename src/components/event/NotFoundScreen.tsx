"use client";

import Link from "next/link";
import {t} from "@/i18n/t";
import {goBack} from "./EventErrorScreen";
import {ErrorPage} from "./ErrorPage";

// «Page not found» inside this site: the error page with code 404, «На головну» (the event home) and
// «Назад». A missing or unavailable EVENT is EventUnavailableScreen. `block` is the column inside the
// shell's content area (the shell keeps its navbar); without it the screen fills the viewport with the footer.
export function NotFoundScreen({title = t("error.notFound"), body = t("error.notFoundDescription"), block = false}: {
    title?: string;
    body?: string;
    block?: boolean;
}) {
    return <ErrorPage mode={block ? "block" : "page"} code={404} title={title} text={body}>
        <Link className="ib-btn ib-btn--primary" href="/">{t("error.goHome")}</Link>
        <button type="button" className="ib-link" onClick={goBack}>{t("error.page.back")}</button>
    </ErrorPage>;
}
