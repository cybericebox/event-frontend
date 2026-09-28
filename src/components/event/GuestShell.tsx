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
    const links = resultsLinkVisible(resultsAvailability(event)) ? [{href: "/scoreboard", label: "Результати"}] : [];
    return <GuestEventContext.Provider value={event}><div className="event-guest-shell">
        <EventNavbar event={event} authenticated={authenticated} pending={pending} />
        <main className="event-guest-main">{authenticated && pathname !== "/join" && pathname !== "/invite" && joinStatus === ParticipationStatusEnum.NoParticipationStatus && event.Registration !== 0 && <div className="event-join-banner"><span>Бажаєте взяти участь у події?</span><Link className="ib-btn ib-btn--primary" href="/join">Приєднатися</Link></div>}{invited && pathname !== "/invite" && <div className="event-join-banner" role="status"><span>{invitation.data?.InvitationExpired ? "Запрошення прострочене: реєстрацію закрито." : invitation.data?.InvitedTeamName ? `Вас запрошено до команди «${invitation.data.InvitedTeamName}».` : "Вас запрошено до події."}</span>{!invitation.data?.InvitationExpired && <Link className="ib-btn ib-btn--primary" href="/invite">Прийняти запрошення</Link>}</div>}{pendingStatus && !invitation.isPending && !invited && <div className="event-join-banner" role="status">Заявка на участь очікує рішення організаторів.</div>}{authenticated && joinStatus === ParticipationStatusEnum.RejectedParticipationStatus && <div className="event-join-banner" role="status">Заявку відхилено. Зверніться до організаторів події.</div>}{children}</main>
        <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row">
            <span className="ib-footer__org"><b>{event.Name}</b><span>CyberICEBox</span></span>
            {links.length > 0 && <nav className="ib-footer__links" aria-label="Посилання події">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>}
        </div></div></footer>
    </div></GuestEventContext.Provider>;
}
