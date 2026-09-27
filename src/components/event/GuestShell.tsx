"use client";

import {createContext, useContext, type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ParticipationStatusEnum} from "@/types/event";
import {EventNavbar} from "./EventNavbar";

const GuestEventContext = createContext<PublicEventInfo | null>(null);
export const useGuestEvent = () => useContext(GuestEventContext);

export function GuestShell({event, authenticated, joinStatus, children}: {
    event: PublicEventInfo;
    authenticated: boolean;
    joinStatus?: number;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const links = event.CanViewResults ? [{href: "/scoreboard", label: "Результати"}] : [];
    return <GuestEventContext.Provider value={event}><div className="event-guest-shell">
        <EventNavbar event={event} authenticated={authenticated} />
        <main className="event-guest-main">{authenticated && pathname !== "/join" && joinStatus === ParticipationStatusEnum.NoParticipationStatus && event.Registration !== 0 && <div className="event-join-banner"><span>Бажаєте взяти участь у події?</span><Link className="ib-btn ib-btn--primary" href="/join">Приєднатися</Link></div>}{authenticated && joinStatus === ParticipationStatusEnum.PendingParticipationStatus && <div className="event-join-banner" role="status">Заявка на участь очікує рішення організаторів.</div>}{children}</main>
        <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row">
            <span className="ib-footer__org"><b>{event.Name}</b><span>CyberICEBox</span></span>
            {links.length > 0 && <nav className="ib-footer__links" aria-label="Посилання події">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>}
        </div></div></footer>
    </div></GuestEventContext.Provider>;
}
