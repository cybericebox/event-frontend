"use client";

import {useState, type ReactNode} from "react";
import Image from "next/image";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Menu, X} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import crest from "@/styles/assets/crest-128.png";
import {ThemeToggle} from "./ThemeToggle";
import {ManagerEntry} from "./manage/ManagerEntry";

function identityHref(path: string, event: PublicEventInfo) {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) return "/";
    const back = `https://${event.Tag}.${domain}/`;
    return `https://id.${domain}${path}?return_to=${encodeURIComponent(back)}`;
}

export function GuestShell({event, authenticated, children}: {
    event: PublicEventInfo;
    authenticated: boolean;
    children: ReactNode;
}) {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const links = [
        {href: "/", label: "Головна"},
        ...(event.ScoreboardVisibility === 2 ? [{href: "/scoreboard", label: "Результати"}] : []),
    ];
    return <div className="event-guest-shell">
        <header className={`ib-navbar${open ? " is-open" : ""}`}>
            <div className="ib-navbar__bar">
                <Link className="ib-navbar__brand" href="/" aria-label={`${event.Name}, головна події`} onClick={() => setOpen(false)}>
                    <Image className="ib-navbar__crest" src={crest} alt="" width={32} height={32} />
                    <span className="ib-navbar__name">{event.Name}<span className="ib-navbar__sub">Подія CyberICEBox</span></span>
                </Link>
                <nav className="ib-navbar__nav" aria-label="Розділи події"><ul className="ib-navbar__tabs">
                    {links.map(link => <li key={link.href}><Link className="ib-navbar__link" href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link></li>)}
                </ul></nav>
                <div className="ib-navbar__actions">
                    {authenticated && <ManagerEntry eventID={event.EventID} variant="nav" />}
                    <ThemeToggle />
                    <a className="ib-btn ib-btn--sm ib-btn--ghost ib-navbar__signin" href={identityHref(authenticated ? "/profile" : "/sign-in", event)}>{authenticated ? "Профіль" : "Увійти"}</a>
                    <button className="ib-navbar__toggle" type="button" aria-expanded={open} aria-controls="event-guest-menu" aria-label={open ? "Закрити меню" : "Відкрити меню"} onClick={() => setOpen(value => !value)}>{open ? <X /> : <Menu />}</button>
                </div>
            </div>
            <nav className="ib-navbar__panel" id="event-guest-menu" aria-label="Мобільне меню">
                {links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
                {authenticated && <ManagerEntry eventID={event.EventID} variant="panel" />}
                <a href={identityHref(authenticated ? "/profile" : "/sign-in", event)}>{authenticated ? "Профіль" : "Увійти"}</a>
            </nav>
        </header>
        <main className="event-guest-main">{children}</main>
        <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row">
            <span className="ib-footer__org"><b>{event.Name}</b><span>CyberICEBox</span></span>
            <nav className="ib-footer__links" aria-label="Посилання події">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
        </div></div></footer>
    </div>;
}
