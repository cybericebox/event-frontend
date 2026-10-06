"use client";

import {useEffect} from "react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {t} from "@/i18n/t";
import {EventLoading} from "./EventLoading";

// A page of a visible event that needs a session, opened without one: straight to the ID
// sign-in with return_to = this page, no screen in between. The loader (the event logo) shows
// for the moment the browser takes to leave. When the sign-in target is the site home (ID not
// configured, or already on the sign-in page) it does nothing, so two redirects never bounce.
export function SignInRedirect({event}: {event?: PublicEventInfo | null}) {
    useEffect(() => {
        const target = signInRedirectTarget(window.location.href);
        if (target !== "/") window.location.replace(target);
    }, []);
    return <EventLoading event={event} full label={t("auth.signInRedirect")} />;
}
