"use client";

import {useEffect} from "react";
import Image from "next/image";
import {useQuery} from "@tanstack/react-query";
import {SearchX} from "lucide-react";
import crest from "@/styles/assets/crest-128.png";
import {BRAND_HEAD, BRAND_TAIL} from "@/i18n/brand";
import {getCurrentUser} from "@/api/clientAuth";
import {markEventGone} from "@/utils/eventGone";
import {idOrigin} from "@/utils/origins";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {t} from "@/i18n/t";
import {ErrorPageCard} from "./ErrorPageCard";

// The one screen for an event the visitor cannot open: it does not exist, was deleted, is
// unpublished, withdrawn or archived for this visitor, or is private and the visitor has no
// access. The API answers all of these alike, so the screen must not tell them apart, and it
// must not redirect (a redirect would reveal that the event exists). It carries no event logo,
// name, accent or favicon, only the platform crest and wordmark. The single way on is «Увійти»
// (ID sign-in, return_to = this page), offered only while nobody is signed in.
export function EventUnavailableScreen() {
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false});
    useEffect(() => {
        document.title = t("shell.eventUnavailable.title");
        markEventGone();
    }, []);
    const signedOut = user.isError || (user.isSuccess && !user.data);
    return <ErrorPageCard
        role="alert"
        head={<>
            <Image className="event-error__logo" src={crest} width={32} height={32} alt="" loading="eager" />
            <p className="event-error__brand">{BRAND_HEAD}<span className="event-error__ice">ICE</span>{BRAND_TAIL}</p>
        </>}
        mark={<SearchX className="event-error__mark event-error__mark--muted" aria-hidden="true" />}
        title={t("shell.eventUnavailable.title")}
        body={t("shell.eventUnavailable.body")}>
        {signedOut && /* the return address is known only in the browser, so it is filled on click */
            <a className="ib-btn" href={`${idOrigin}/sign-in`} onClick={e => {e.currentTarget.href = signInRedirectTarget(window.location.href);}}>{t("account.signIn")}</a>}
    </ErrorPageCard>;
}
