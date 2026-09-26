"use client";

import {type ReactNode} from "react";
import Link from "next/link";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventNavbar} from "./EventNavbar";

export function GuestShell({event, authenticated, children}: {
    event: PublicEventInfo;
    authenticated: boolean;
    children: ReactNode;
}) {
    const links = [
        {href: "/", label: "Головна"},
        ...(event.ScoreboardVisibility === 2 ? [{href: "/scoreboard", label: "Результати"}] : []),
    ];
    return <div className="event-guest-shell">
        <EventNavbar event={event} authenticated={authenticated} />
        <main className="event-guest-main">{children}</main>
        <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row">
            <span className="ib-footer__org"><b>{event.Name}</b><span>CyberICEBox</span></span>
            <nav className="ib-footer__links" aria-label="Посилання події">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
        </div></div></footer>
    </div>;
}
