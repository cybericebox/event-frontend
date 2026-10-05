"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Lock} from "lucide-react";
import {signOut} from "@/api/authAPI";
import {getCurrentUser} from "@/api/clientAuth";
import {mainOrigin} from "@/utils/origins";
import {signInRedirectTarget} from "@/utils/signInRedirect";
import {t} from "@/i18n/t";
import {EventBrandLogo} from "./EventBrandLogo";
import {EventLoading} from "./EventLoading";
import {SignInRequired} from "./SignInRequired";
import {EventButton} from "@/components/ui/EventButton";
import "@/styles/error-screen.css";

// A page the signed-in account has no rights for (403). Same frame as EventNotFoundScreen:
// event logo, Lock mark, title, one line with the account, and two ways out: another
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
    if (!user.data) return <SignInRequired />;
    return <main className="event-error event-error--page" role="alert">
        <EventBrandLogo className="event-error__logo" size={64} />
        <Lock className="event-error__mark event-error__mark--muted" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{t("auth.noAccess.body", {email: user.data?.Email ?? ""})}</p>
        {failed && <p role="alert">{t("account.signOutFailed")}</p>}
        <div className="event-error__actions">
            <EventButton className="ib-btn ib-btn--primary" type="button" disabled={working} busy={working} onClick={() => void switchAccount()}>{t("auth.noAccess.switch")}</EventButton>
            <a className="ib-btn" href={homeHref}>{t("auth.noAccess.home")}</a>
        </div>
    </main>;
}
