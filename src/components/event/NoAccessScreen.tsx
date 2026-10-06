"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {signOut} from "@/api/authAPI";
import {getCurrentUser} from "@/api/clientAuth";
import {mainOrigin} from "@/utils/origins";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {t} from "@/i18n/t";
import {EventLoading} from "./EventLoading";
import {SignInRedirect} from "./SignInRedirect";
import {EventButton} from "@/components/ui/EventButton";
import {ErrorPage} from "./ErrorPage";

// A feature of a visible event the signed-in account has no rights for (403: /manage, /live).
// An event the account cannot see at all is EventUnavailableScreen.
// The error page with code 403, title, one line with the account, and two ways out: another
// account (sign out, then sign in back to this page) or home. `homeHref` defaults to the
// platform home, for pages where the event home is the page itself.
export function NoAccessScreen({title = t("auth.noAccess.title"), homeHref = mainOrigin || "/"}: {title?: string; homeHref?: string}) {
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false});
    const [working, setWorking] = useState(false);
    const [failed, setFailed] = useState(false);

    async function switchAccount() {
        setWorking(true);
        setFailed(false);
        try {
            await signOut();
            window.location.replace(signInRedirectTarget(window.location.href));
        } catch {
            setFailed(true);
            setWorking(false);
        }
    }

    if (user.isPending) return <EventLoading full label={t("shell.loadingEventFull")} />;
    // The session ended meanwhile: that is a 401 after all.
    if (!user.data) return <SignInRedirect />;
    return <ErrorPage mode="page" role="alert" code={403} title={title} homeHref={homeHref}
        text={<>
            {t("auth.noAccess.body", {email: user.data?.Email ?? ""})}
            {failed && <><br />{t("account.signOutFailed")}</>}
        </>}>
        <EventButton className="ib-btn ib-btn--primary" type="button" disabled={working} busy={working} onClick={() => void switchAccount()}>{t("auth.noAccess.switch")}</EventButton>
        <a className="ib-link" href={homeHref}>{t("auth.noAccess.home")}</a>
    </ErrorPage>;
}
