"use client";

import {createContext, useContext, type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {getInvitationInfo} from "@/api/clientAuth";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ParticipationStatusEnum} from "@/types/event";
import {useParticipation} from "./participation/participationRules";
import {EventNavbar} from "./EventNavigation";
import {SiteBannerBar} from "./SiteBanners";
import {t} from "@/i18n/t";
import {EventFooter} from "./EventFooter";

const GuestEventContext = createContext<PublicEventInfo | null>(null);
export const useGuestEvent = () => useContext(GuestEventContext);

export function GuestShell({event, authenticated, joinStatus, pending = false, notice, children}: {
    event: PublicEventInfo;
    authenticated: boolean;
    joinStatus?: number;
    pending?: boolean;
    // A full-width bar between the navbar and the page (the private preview).
    notice?: ReactNode;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const pendingStatus = authenticated && joinStatus === ParticipationStatusEnum.PendingParticipationStatus;
    const invitation = useQuery({queryKey: ["event-invitation-status", event.EventID], queryFn: getInvitationInfo, enabled: pendingStatus, retry: false, refetchOnWindowFocus: false});
    const invited = pendingStatus && invitation.data?.Invited === true;
    // The join prompt follows the server's verdict (schedule, registration mode, staff), not the registration type alone.
    const notJoined = authenticated && joinStatus === ParticipationStatusEnum.NoParticipationStatus;
    const participation = useParticipation(event.EventID, notJoined && pathname !== "/join" && pathname !== "/invite");
    return <GuestEventContext.Provider value={event}><div className="event-guest-shell">
        <EventNavbar event={event} authenticated={authenticated} pending={pending} />
        <SiteBannerBar eventID={event.EventID} />
        <main className="event-guest-main">{notice}<div className="event-page-content">{authenticated && pathname !== "/join" && pathname !== "/invite" && joinStatus === ParticipationStatusEnum.NoParticipationStatus && participation.data?.Register.Allowed === true && <div className="event-join-banner"><span>{t("shell.join.prompt")}</span><Link className="ib-btn ib-btn--primary" href="/join">{t("shell.join.action")}</Link></div>}{invited && pathname !== "/invite" && <div className="event-join-banner" role="status"><span>{invitation.data?.InvitationExpired ? t("shell.invite.expired") : invitation.data?.InvitedTeamName ? t("shell.invite.team", {team: invitation.data.InvitedTeamName}) : t("shell.invite.event")}</span>{!invitation.data?.InvitationExpired && <Link className="ib-btn ib-btn--primary" href="/invite">{t("content.join.invite")}</Link>}</div>}{pendingStatus && !invitation.isPending && !invited && <div className="event-join-banner" role="status">{t("shell.join.pending")}</div>}{authenticated && joinStatus === ParticipationStatusEnum.RejectedParticipationStatus && <div className="event-join-banner" role="status">{t("shell.join.rejected")}</div>}{children}</div></main>
        <EventFooter />
    </div></GuestEventContext.Provider>;
}
