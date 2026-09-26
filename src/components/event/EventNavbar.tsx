"use client";

import {useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useQueryClient} from "@tanstack/react-query";
import {Bell, LogOut, Menu, Network, Settings2, UserRound, Users, X} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {signOut} from "@/api/authAPI";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import crest from "@/styles/assets/crest-128.png";
import {ThemeToggle} from "./ThemeToggle";
import {ManagerEntry} from "./manage/ManagerEntry";

type Props = {
    event: PublicEventInfo;
    authenticated: boolean;
    approved?: boolean;
    hasTeam?: boolean;
    useVPN?: boolean;
    management?: boolean;
};

function identityHref(path: string, event: PublicEventInfo) {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) return "/";
    const back = `https://${event.Tag}.${domain}/`;
    return `https://id.${domain}${path}?return_to=${encodeURIComponent(back)}`;
}

function AccountMenu({event, approved, hasTeam, useVPN}: Required<Pick<Props, "event" | "approved" | "hasTeam" | "useVPN">>) {
    const [open, setOpen] = useState(false);
    const [signOutError, setSignOutError] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();
    const leave = async () => {
        try {
            setSignOutError(false);
            await signOut();
            queryClient.clear();
            router.push("/");
            router.refresh();
        } catch {
            setSignOutError(true);
        }
    };
    return <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><button className="event-account__trigger" type="button" aria-label="Меню акаунта" aria-expanded={open}><UserRound size={18} aria-hidden="true" /></button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="event-account__menu">
            <a href={identityHref("/profile", event)}><UserRound size={16} />Профіль</a>
            {approved && <Link href="/team" onClick={() => setOpen(false)}><Users size={16} />{event.Participation === 0 ? "Моя участь" : "Моя команда"}</Link>}
            {approved && hasTeam && useVPN && <Link href="/vpn" onClick={() => setOpen(false)}><Network size={16} />Підключення VPN</Link>}
            <button type="button" onClick={() => void leave()}><LogOut size={16} />Вийти</button>
            {signOutError && <p className="event-account__error" role="alert">Не вдалося вийти. Повторіть спробу.</p>}
        </PopoverContent>
    </Popover>;
}

export function EventNavbar({event, authenticated, approved = false, hasTeam = false, useVPN = false, management = false}: Props) {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const links = [
        {href: "/", label: "Головна"},
        ...(approved ? [{href: "/challenges", label: "Завдання"}] : []),
        ...((approved ? event.ScoreboardVisibility !== 0 : event.ScoreboardVisibility === 2) ? [{href: "/scoreboard", label: "Результати"}] : []),
    ];
    return <header className={`ib-navbar event-navbar${open ? " is-open" : ""}`}>
        <div className="ib-navbar__bar">
            <Link className="ib-navbar__brand" href="/" aria-label={`${event.Name}, головна події`} onClick={() => setOpen(false)}>
                <Image className="ib-navbar__crest" src={crest} alt="" width={32} height={32} />
                <span className="ib-navbar__name">{event.Name}</span>
            </Link>
            <nav className="ib-navbar__nav" aria-label="Розділи події"><ul className="ib-navbar__tabs">
                {links.map(link => <li key={link.href}><Link className="ib-navbar__link" href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link></li>)}
            </ul></nav>
            <div className="ib-navbar__actions">
                {authenticated && (management ? <Link className="ib-btn ib-btn--sm event-manage-entry" href="/manage" aria-current={path.startsWith("/manage") ? "page" : undefined}><Settings2 size={16} aria-hidden="true" />Адміністрування</Link> : <ManagerEntry eventID={event.EventID} variant="nav" />)}
                <ThemeToggle />
                {approved && <button className="event-navbar__icon" type="button" aria-label="Сповіщення поки недоступні" title="Сповіщення поки недоступні" disabled><Bell size={18} /></button>}
                {authenticated ? <AccountMenu event={event} approved={approved} hasTeam={hasTeam} useVPN={useVPN} /> : <a className="ib-btn ib-btn--sm ib-btn--ghost ib-navbar__signin" href={identityHref("/sign-in", event)}>Увійти</a>}
                <button className="ib-navbar__toggle" type="button" aria-expanded={open} aria-controls="event-menu" aria-label={open ? "Закрити меню" : "Відкрити меню"} onClick={() => setOpen(value => !value)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
            </div>
        </div>
        <nav className="ib-navbar__panel" id="event-menu" aria-label="Мобільне меню">
            {links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
            {authenticated && (management ? <Link href="/manage" onClick={() => setOpen(false)}>Адміністрування</Link> : <ManagerEntry eventID={event.EventID} variant="panel" />)}
        </nav>
    </header>;
}
