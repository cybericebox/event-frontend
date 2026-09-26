"use client";

import {useState, type ReactNode} from "react";
import Image from "next/image";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {ChartNoAxesCombined, Flag, Home, Menu, UserRound, Users, X} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import crest from "@/styles/assets/crest-128.png";
import {ThemeToggle} from "./ThemeToggle";
import {ManagerEntry} from "./manage/ManagerEntry";

export function ParticipantShell({event, children}: {event: PublicEventInfo; children: ReactNode}) {
    const path = usePathname();
    const [drawer, setDrawer] = useState(false);
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    const profileHref = domain ? `https://id.${domain}/profile?return_to=${encodeURIComponent(`https://${event.Tag}.${domain}/`)}` : "/";
    const links = [
        {href: "/challenges", label: "Завдання", Icon: Flag},
        ...(event.ScoreboardVisibility !== 0 ? [{href: "/scoreboard", label: "Результати", Icon: ChartNoAxesCombined}] : []),
        ...(event.Participation === 1 ? [{href: "/team", label: "Моя команда", Icon: Users}] : []),
        {href: "/", label: "Про подію", Icon: Home},
    ];
    const phase = event.Status === 1 ? "До початку" : event.Status === 2 ? "Триває" : event.Status === 3 ? "Завершено" : "Подія";
    return <div className={`ib-event-shell${drawer ? " is-drawer-open" : ""}`}>
        <div className="ib-event-shell__layout">
            <header className="ib-event-shell__mbar ib-mass">
                <button className="ib-event-shell__mbtn" type="button" aria-label="Відкрити меню події" aria-controls="event-tower" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu /></button>
                <span className="ib-event-shell__mname">{event.Name}</span>
                <span className="ib-event-shell__mclock">{phase}</span>
            </header>
            <aside className="ib-tower ib-mass ib-mass-waves" id="event-tower" aria-label="Подія">
                <div className="ib-tower__head">
                    <Image className="ib-tower__crest" src={crest} alt="" width={32} height={32} />
                    <div className="ib-tower__title"><b className="ib-tower__event">{event.Name}</b><span className="ib-tower__sub">CyberICEBox</span></div>
                    <button className="ib-tower__close" type="button" aria-label="Закрити меню" onClick={() => setDrawer(false)}><X /></button>
                </div>
                <div className="ib-tower__live"><span className="ib-tower__phase">{phase}</span></div>
                <nav className="ib-tower__nav" aria-label="Розділи події">{links.map(({href, label, Icon}) => <Link key={href} className="ib-tower__item" href={href} aria-current={path === href ? "page" : undefined} onClick={() => setDrawer(false)}><Icon className="ib-icon" aria-hidden="true" /><span className="ib-tower__label">{label}</span></Link>)}</nav>
                <div className="ib-tower__foot">
                    <ManagerEntry eventID={event.EventID} variant="tower" />
                    <a className="ib-tower__item" href={profileHref}><UserRound className="ib-icon" aria-hidden="true" /><span className="ib-tower__label">Профіль</span></a>
                    <ThemeToggle onMass />
                </div>
            </aside>
            <button className="ib-event-shell__backdrop" type="button" aria-label="Закрити меню" onClick={() => setDrawer(false)} />
            <main className="ib-event-shell__main"><div className="event-page-content">{children}</div></main>
        </div>
    </div>;
}
