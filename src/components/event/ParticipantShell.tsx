"use client";

import {createContext, useContext, type ReactNode} from "react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {OwnTeam} from "@/api/clientAuth";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {EventNavbar} from "./EventNavigation";
import {SiteBannerBar} from "./SiteBanners";
import {EventVpnProvider} from "./vpn/EventVpn";
import {resultsAvailability, resultsLinkVisible} from "@/types/resultsAvailability";
import {EventFooter} from "./EventFooter";
import {MissingFieldsNotice} from "./MissingFieldsNotice";

type ParticipantContextValue = {event: PublicEventInfo; participantInfo: ParticipantEventInfo; ownTeam: OwnTeam | null};
const ParticipantContext = createContext<ParticipantContextValue | null>(null);
export const useParticipantContext = () => useContext(ParticipantContext);

export function ParticipantShell({event, participantInfo, ownTeam, children}: {
    event: PublicEventInfo;
    participantInfo: ParticipantEventInfo;
    ownTeam: OwnTeam | null;
    children: ReactNode;
}) {
    // The VPN modal needs an admitted team; W5 serves the stand only then.
    const vpn = participantInfo.HasInfrastructureChallenges && !!ownTeam && ownTeam.Admitted !== false;
    return <ParticipantContext.Provider value={{event, participantInfo, ownTeam}}><EventVpnProvider eventID={event.EventID} eventTag={event.Tag} enabled={vpn}><div className="event-guest-shell">
        <EventNavbar event={event} authenticated approved canViewResults={resultsLinkVisible(resultsAvailability(participantInfo))} />
        <SiteBannerBar eventID={event.EventID} />
        <main className="event-guest-main"><div className="event-page-content"><MissingFieldsNotice eventID={event.EventID} ownTeam={ownTeam} />{children}</div></main>
        <EventFooter eventName={event.Name} />
    </div></EventVpnProvider></ParticipantContext.Provider>;
}
