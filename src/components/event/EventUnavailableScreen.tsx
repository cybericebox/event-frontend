"use client";

import {useEffect} from "react";
import {useQuery} from "@tanstack/react-query";
import {getCurrentUser} from "@/api/clientAuth";
import {markEventGone} from "@/utils/eventGone";
import {idOrigin} from "@/utils/origins";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {t} from "@/i18n/t";
import {ErrorPage} from "./ErrorPage";

// The one screen for an event the visitor cannot open: it does not exist, was deleted, is
// unpublished, withdrawn or archived for this visitor, or is private and the visitor has no
// access. The API answers all of these alike, so the screen must not tell them apart, and it
// must not redirect (a redirect would reveal that the event exists). It is the 404 error page in
// page mode with no event logo, name, accent or favicon: the footer carries the platform crest.
// The single way on is a secondary «Увійти» (ID sign-in, return_to = this page), offered only
// while nobody is signed in: a signed-in account, or a failed session check that is not a 401, gets none.
export function EventUnavailableScreen() {
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false});
    useEffect(() => {
        document.title = t("shell.eventUnavailable.title");
        markEventGone();
    }, []);
    // getCurrentUser answers null for a 401; any other failed answer says nothing about the session,
    // while a request that never got an answer (offline) offers the sign-in.
    const status = (user.error as {status?: unknown} | null)?.status;
    const signedOut = (user.isSuccess && !user.data) || (user.isError && typeof status !== "number");
    return <ErrorPage mode="page" role="alert" platformBrand code={404}
        title={[t("shell.eventUnavailable.line1"), t("shell.eventUnavailable.line2")]}
        text={t("shell.eventUnavailable.body")}>
        {signedOut && /* the return address is known only in the browser, so it is filled on click */
            <a className="ib-btn" href={`${idOrigin}/sign-in`} onClick={e => {e.currentTarget.href = signInRedirectTarget(window.location.href);}}>{t("account.signIn")}</a>}
    </ErrorPage>;
}
