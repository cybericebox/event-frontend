"use client";

import {LogIn} from "lucide-react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {idOrigin} from "@/utils/origins";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {t} from "@/i18n/t";
import {EventBrandLogo} from "./EventBrandLogo";
import "@/styles/error-screen.css";

// A page that needs a session (401). The event site never sends anyone to the sign-in by
// itself: the screen says so in one line and the visitor clicks «Увійти» (ID sign-in,
// return_to = this page). `full` fills the viewport; without it the screen centers in its block.
export function SignInRequired({event, full = true}: {event?: PublicEventInfo | null; full?: boolean}) {
    return <main className={full ? "event-error event-error--page" : "event-error"} role="alert">
        <EventBrandLogo event={event} className="event-error__logo" size={64} />
        <LogIn className="event-error__mark event-error__mark--muted" aria-hidden="true" />
        <h1>{t("auth.signInRequired.title")}</h1>
        <p>{t("auth.signInRequired.body")}</p>
        <div className="event-error__actions">
            {/* the return address is known only in the browser, so it is filled on click */}
            <a className="ib-btn ib-btn--primary" href={`${idOrigin}/sign-in`} onClick={e => {e.currentTarget.href = signInRedirectTarget(window.location.href);}}>{t("account.signIn")}</a>
        </div>
    </main>;
}
