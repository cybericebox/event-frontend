"use client";

import {createContext, useContext, type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {getInvitationInfo} from "@/api/clientAuth";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ParticipationStatusEnum} from "@/types/event";
import {useParticipation} from "./participation/participationRules";
import {ParticipantContext, type ParticipantContextValue} from "./ParticipantShell";
import {EventVpnProvider} from "./vpn/EventVpn";
import {MissingFieldsNotice} from "./MissingFieldsNotice";
import {resultsAvailability, resultsLinkVisible} from "@/types/resultsAvailability";
import {useParticipantPreview, previewResultsAvailability} from "./ParticipantPreview";
import {EventNavbar} from "./EventNavigation";
import {SiteBannerBar} from "./SiteBanners";
import {t} from "@/i18n/t";
import {EventFooter} from "./EventFooter";
import {SkipLink} from "@/components/ui/SkipLink";

const GuestEventContext = createContext<PublicEventInfo | null>(null);
export const useGuestEvent = () => useContext(GuestEventContext);

export function GuestShell({event, authenticated, joinStatus, pending = false, notice, children, participant = null}: {
    event: PublicEventInfo;
    authenticated: boolean;
    joinStatus?: number;
    pending?: boolean;
    // A full-width bar between the navbar and the page (the private preview).
    notice?: ReactNode;
    children: ReactNode;
    participant?: ParticipantContextValue | null;
}) {
    const pathname = usePathname();
    const preview = useParticipantPreview(event.EventID);
    const approved = !!participant || preview.active && preview.state!.status === ParticipationStatusEnum.ApprovedParticipationStatus;
    if (preview.active) joinStatus = preview.state!.status;
    const pendingStatus = authenticated && joinStatus === ParticipationStatusEnum.PendingParticipationStatus;
    const invitation = useQuery({queryKey: ["event-invitation-status", event.EventID], queryFn: getInvitationInfo, enabled: pendingStatus && !preview.active, retry: false, refetchOnWindowFocus: false});
    const invited = !preview.active && pendingStatus && invitation.data?.Invited === true;
    // The join prompt follows the server's verdict (schedule, registration mode, staff), not the registration type alone.
    const notJoined = authenticated && joinStatus === ParticipationStatusEnum.NoParticipationStatus;
    const participation = useParticipation(event.EventID, notJoined && !preview.active && pathname !== "/join" && pathname !== "/invite");
    return <GuestEventContext.Provider value={event}><ParticipantContext.Provider value={participant}><EventVpnProvider eventID={event.EventID} eventTag={event.Tag} moderators={preview.active} enabled={preview.active ? approved && !!preview.config?.InfrastructureAllowed && (event.Participation !== 1 || !!preview.state?.team?.Formed) : !!participant?.participantInfo.HasInfrastructureChallenges && !!participant.ownTeam && participant.ownTeam.Admitted !== false}><div className="event-guest-shell">
        <SkipLink />
        <EventNavbar event={event} authenticated={authenticated} approved={approved} canViewResults={preview.active ? resultsLinkVisible(previewResultsAvailability(resultsAvailability(event), preview.state!.status, preview.config)) : !!participant && resultsLinkVisible(resultsAvailability(participant.participantInfo))} pending={pending} />
        <SiteBannerBar eventID={event.EventID} />
        <main id="main" tabIndex={-1} className="event-guest-main">{notice}<div className="event-page-content">{authenticated && pathname !== "/join" && pathname !== "/invite" && joinStatus === ParticipationStatusEnum.NoParticipationStatus && (preview.active || participation.data?.Register.Allowed === true) && <div className="event-join-banner"><span>{t("shell.join.prompt")}</span><Link className="ib-btn ib-btn--primary" href="/join">{t("shell.join.action")}</Link></div>}{invited && pathname !== "/invite" && <div className="event-join-banner" role="status"><span>{invitation.data?.InvitationExpired ? t("shell.invite.expired") : invitation.data?.InvitedTeamName ? t("shell.invite.team", {team: invitation.data.InvitedTeamName}) : t("shell.invite.event")}</span>{!invitation.data?.InvitationExpired && <Link className="ib-btn ib-btn--primary" href="/invite">{t("content.join.invite")}</Link>}</div>}{pendingStatus && (preview.active || !invitation.isPending) && !invited && <div className="event-join-banner" role="status">{t("shell.join.pending")}</div>}{authenticated && joinStatus === ParticipationStatusEnum.RejectedParticipationStatus && <div className="event-join-banner" role="status">{t("shell.join.rejected")}</div>}{participant && <MissingFieldsNotice eventID={event.EventID} ownTeam={participant.ownTeam} />}{children}</div></main>
        <EventFooter signature={event.FooterSignature} eventName={event.Name} showTheme={!authenticated && !pending} />
    </div></EventVpnProvider></ParticipantContext.Provider></GuestEventContext.Provider>;
}
