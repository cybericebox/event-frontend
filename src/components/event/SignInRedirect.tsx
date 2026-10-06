"use client";

import {useEffect} from "react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {createJoinIntent} from "@/utils/joinIntent";
import {t} from "@/i18n/t";
import {EventLoading} from "./EventLoading";

// A page of a visible event that needs a session, opened without one: straight to the ID
// sign-in with return_to = this page, no screen in between. The loader (the event logo) shows
// for the moment the browser takes to leave. When the sign-in target is the site home (ID not
// configured, or already on the sign-in page) it does nothing, so two redirects never bounce.
export function SignInRedirect({event}: {event?: PublicEventInfo | null}) {
    useEffect(() => {
        // Registration continues by itself after the sign-in, but only for this browser's own flow:
        // the join page needs the nonce kept here (joinIntent.ts).
        const here = new URL(window.location.href);
        here.searchParams.delete("continue");
        if (here.pathname === "/join" && event) here.searchParams.set("continue", createJoinIntent(event.EventID));
        const target = signInRedirectTarget(here.toString());
        if (target !== "/") window.location.replace(target);
    }, []);
    return <EventLoading event={event} full label={t("auth.signInRedirect")} />;
}
