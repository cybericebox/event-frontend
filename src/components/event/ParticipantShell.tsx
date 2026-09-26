"use client";

import {createContext, useContext, type ReactNode} from "react";
import Link from "next/link";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {OwnTeam} from "@/api/clientAuth";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {EventNavbar} from "./EventNavbar";

type ParticipantContextValue = {event: PublicEventInfo; participantInfo: ParticipantEventInfo; ownTeam: OwnTeam | null};
const ParticipantContext = createContext<ParticipantContextValue | null>(null);
export const useParticipantContext = () => useContext(ParticipantContext);

export function ParticipantShell({event, participantInfo, ownTeam, children}: {
    event: PublicEventInfo;
    participantInfo: ParticipantEventInfo;
    ownTeam: OwnTeam | null;
    children: ReactNode;
}) {
    return <ParticipantContext.Provider value={{event, participantInfo, ownTeam}}><div className="event-guest-shell">
        <EventNavbar event={event} authenticated approved hasTeam={!!ownTeam} useVPN={participantInfo.UseVPN} canViewResults={participantInfo.CanViewResults} />
        <main className="event-guest-main"><div className="event-page-content">{children}</div></main>
        <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row"><span className="ib-footer__org"><b>{event.Name}</b><span>CyberICEBox</span></span><nav className="ib-footer__links" aria-label="Посилання події"><Link href="/">Головна</Link><Link href="/challenges">Завдання</Link></nav></div></div></footer>
    </div></ParticipantContext.Provider>;
}
