"use client";

import {createContext, useContext, type ReactNode} from "react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {OwnTeam} from "@/api/clientAuth";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {EventNavbar} from "./EventNavigation";
import {EventVpnProvider} from "./vpn/EventVpn";
import {resultsAvailability, resultsLinkVisible} from "@/types/resultsAvailability";
import {t} from "@/i18n/t";
import {PlatformCredit} from "./PlatformCredit";
import {MissingFieldsNotice} from "./MissingFieldsNotice";
import {CookieSettingsLink} from "@/components/consent/CookieSettingsLink";

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
    return <ParticipantContext.Provider value={{event, participantInfo, ownTeam}}><EventVpnProvider eventID={event.EventID} enabled={vpn}><div className="event-guest-shell">
        <EventNavbar event={event} authenticated approved canViewResults={resultsLinkVisible(resultsAvailability(participantInfo))} />
        <main className="event-guest-main"><div className="event-page-content"><MissingFieldsNotice eventID={event.EventID} ownTeam={ownTeam} />{children}</div></main>
        <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row"><span className="ib-footer__org"><PlatformCredit /></span><nav className="ib-footer__links" aria-label={t("shell.footerLinks")}><CookieSettingsLink /></nav></div></div></footer>
    </div></EventVpnProvider></ParticipantContext.Provider>;
}
