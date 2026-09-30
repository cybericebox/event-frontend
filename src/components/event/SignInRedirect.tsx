"use client";

import {useEffect} from "react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {t} from "@/i18n/t";
import {EventLoading} from "./EventLoading";

// A page that needs a session (401): no card, no button. It replaces the address with
// the ID sign-in (return_to = this page), so Back does not bounce, and shows the event
// loader meanwhile. `full` fills the viewport; without it the loader centers in its block.
export function SignInRedirect({event, full = true}: {event?: PublicEventInfo | null; full?: boolean}) {
    useEffect(() => {
        const target = signInRedirectTarget(window.location.href);
        if (target !== "/" || window.location.pathname !== "/") window.location.replace(target);
    }, []);
    return <EventLoading event={event} full={full} label={t("auth.redirecting")} />;
}
