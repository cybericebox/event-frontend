"use client";

import {useQuery} from "@tanstack/react-query";
import {Lock, SearchX} from "lucide-react";
import {getCurrentUser} from "@/api/clientAuth";
import {idOrigin, mainOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";
import {EventBrandLogo} from "./EventBrandLogo";
import {EventLoading} from "./EventLoading";
import "@/styles/error-screen.css";

// The event of this address is not public: it does not exist, is not published yet,
// or this account has no access. A visitor is offered the sign-in (organizers and
// invited participants see unpublished events); a signed-in account learns it has
// no access. Both lead back to the platform. Same frame as EventErrorScreen.
export function EventNotFoundScreen() {
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false});
    if (user.isPending) return <EventLoading full label={t("shell.loadingEventFull")} />;
    const signedIn = !!user.data;
    const Icon = signedIn ? Lock : SearchX;
    return <main className="event-error event-error--page" role="alert">
        <EventBrandLogo className="event-error__logo" size={64} />
        <Icon className="event-error__mark event-error__mark--muted" aria-hidden="true" />
        <h1>{signedIn ? t("shell.missing.noAccessTitle") : t("shell.missing.title")}</h1>
        <p>{signedIn ? t("shell.missing.noAccessBody") : t("shell.missing.body")}</p>
        <div className="event-error__actions">
            {/* return_to is filled on click: the page address is known only in the browser */}
            {!signedIn && <a className="ib-btn ib-btn--primary" href={`${idOrigin}/sign-in`} onClick={event => {event.currentTarget.href = `${idOrigin}/sign-in?return_to=${encodeURIComponent(window.location.href)}`;}}>{t("account.signIn")}</a>}
            <a className={signedIn ? "ib-btn ib-btn--primary" : "ib-btn"} href={mainOrigin || "/"}>{t("shell.missing.home")}</a>
        </div>
    </main>;
}
