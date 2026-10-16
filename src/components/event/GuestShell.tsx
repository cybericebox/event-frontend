"use client";

import {createContext, useContext, type ReactNode} from "react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ParticipationStatusEnum} from "@/types/event";
import {ParticipantContext, type ParticipantContextValue} from "./ParticipantShell";
import {EventVpnProvider} from "./vpn/EventVpn";
import {MissingFieldsNotice} from "./MissingFieldsNotice";
import {resultsAvailability, resultsLinkVisible} from "@/types/resultsAvailability";
import {useParticipantPreview, previewResultsAvailability} from "./ParticipantPreview";
import {EventNavbar} from "./EventNavigation";
import {SiteBannerBar} from "./SiteBanners";
import {EventFooter} from "./EventFooter";
import {SkipLink} from "@/components/ui/SkipLink";

const GuestEventContext = createContext<PublicEventInfo | null>(null);
export const useGuestEvent = () => useContext(GuestEventContext);

export function GuestShell({event, authenticated, pending = false, notice, children, participant = null}: {
    event: PublicEventInfo;
    authenticated: boolean;
    joinStatus?: number;
    pending?: boolean;
    // A full-width bar between the navbar and the page (the private preview).
    notice?: ReactNode;
    children: ReactNode;
    participant?: ParticipantContextValue | null;
}) {
    const preview = useParticipantPreview(event.EventID);
    const approved = !!participant || preview.active && preview.state!.status === ParticipationStatusEnum.ApprovedParticipationStatus;
    return <GuestEventContext.Provider value={event}><ParticipantContext.Provider value={participant}><EventVpnProvider eventID={event.EventID} eventTag={event.Tag} moderators={preview.active} enabled={preview.active ? approved && !!preview.config?.InfrastructureAllowed && (event.Participation !== 1 || !!preview.state?.team?.Formed) : !!participant?.participantInfo.HasInfrastructureChallenges && !!participant.ownTeam && participant.ownTeam.Admitted !== false}><div className="event-guest-shell">
        <SkipLink />
        <EventNavbar event={event} authenticated={authenticated} approved={approved} canViewResults={preview.active ? resultsLinkVisible(previewResultsAvailability(resultsAvailability(event), preview.state!.status, preview.config)) : !!participant && resultsLinkVisible(resultsAvailability(participant.participantInfo))} pending={pending} />
        <SiteBannerBar eventID={event.EventID} />
        <main id="main" tabIndex={-1} className="event-guest-main">{notice}<div className="event-page-content">{participant && <MissingFieldsNotice eventID={event.EventID} ownTeam={participant.ownTeam} />}{children}</div></main>
        <EventFooter signature={event.FooterSignature} eventName={event.Name} showTheme={!authenticated && !pending} />
    </div></EventVpnProvider></ParticipantContext.Provider></GuestEventContext.Provider>;
}
