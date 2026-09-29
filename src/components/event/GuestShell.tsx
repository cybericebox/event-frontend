"use client";

import {createContext, useContext, type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {getInvitationInfo} from "@/api/clientAuth";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ParticipationStatusEnum} from "@/types/event";
import {EventNavbar} from "./EventNavigation";
import {resultsAvailability, resultsLinkVisible} from "@/types/resultsAvailability";
import {t} from "@/i18n/t";
import {PlatformCredit} from "./PlatformCredit";
import {CookieSettingsLink} from "@/components/consent/CookieSettingsLink";

const GuestEventContext = createContext<PublicEventInfo | null>(null);
export const useGuestEvent = () => useContext(GuestEventContext);

export function GuestShell({event, authenticated, joinStatus, pending = false, children}: {
    event: PublicEventInfo;
    authenticated: boolean;
    joinStatus?: number;
    pending?: boolean;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const pendingStatus = authenticated && joinStatus === ParticipationStatusEnum.PendingParticipationStatus;
    const invitation = useQuery({queryKey: ["event-invitation-status", event.EventID], queryFn: getInvitationInfo, enabled: pendingStatus, retry: false, refetchOnWindowFocus: false});
    const invited = pendingStatus && invitation.data?.Invited === true;
    const links = resultsLinkVisible(resultsAvailability(event)) ? [{href: "/scoreboard", label: t("nav.results")}] : [];
    return <GuestEventContext.Provider value={event}><div className="event-guest-shell">
        <EventNavbar event={event} authenticated={authenticated} pending={pending} />
        <main className="event-guest-main">{authenticated && pathname !== "/join" && pathname !== "/invite" && joinStatus === ParticipationStatusEnum.NoParticipationStatus && event.Registration !== 0 && <div className="event-join-banner"><span>{t("shell.join.prompt")}</span><Link className="ib-btn ib-btn--primary" href="/join">{t("shell.join.action")}</Link></div>}{invited && pathname !== "/invite" && <div className="event-join-banner" role="status"><span>{invitation.data?.InvitationExpired ? t("shell.invite.expired") : invitation.data?.InvitedTeamName ? t("shell.invite.team", {team: invitation.data.InvitedTeamName}) : t("shell.invite.event")}</span>{!invitation.data?.InvitationExpired && <Link className="ib-btn ib-btn--primary" href="/invite">{t("content.join.invite")}</Link>}</div>}{pendingStatus && !invitation.isPending && !invited && <div className="event-join-banner" role="status">{t("shell.join.pending")}</div>}{authenticated && joinStatus === ParticipationStatusEnum.RejectedParticipationStatus && <div className="event-join-banner" role="status">{t("shell.join.rejected")}</div>}{children}</main>
        <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row">
            <span className="ib-footer__org"><b>{event.Name}</b><PlatformCredit /></span>
            <nav className="ib-footer__links" aria-label={t("shell.footerLinks")}>{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}<CookieSettingsLink /></nav>
        </div></div></footer>
    </div></GuestEventContext.Provider>;
}
