"use client";

import {useLayoutEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ChevronDown, LogOut, Menu, UserRound, Users, X} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {getNavigationPages} from "@/api/navigationPages";
import {getManageAccess, getManagePages} from "@/api/manage";
import {signOut} from "@/api/authAPI";
import {getCurrentUser, profilePictureUrl} from "@/api/clientAuth";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {EventBrandLogo} from "./EventBrandLogo";
import {ThemeToggle} from "./ThemeToggle";
import {VpnHeaderButton} from "./vpn/EventVpn";
import {ManagerEntry} from "./manage/ManagerEntry";
import {NotificationsPopover} from "./NotificationsPopover";
import {beforeChallenges, comparePageOrder} from "./content/pageNavigationOrder";
import {resultsAvailability, resultsLinkVisible} from "@/types/resultsAvailability";

type Props = {
    event: PublicEventInfo;
    authenticated: boolean;
    approved?: boolean;
    canViewResults?: boolean;
    // Account and participation are still loading: show a neutral bar
    // instead of guest navigation that would flash for signed-in users.
    pending?: boolean;
};

function identityHref(path: string, event: PublicEventInfo) {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) return "/";
    const back = `https://${event.Tag}.${domain}/`;
    return `https://id.${domain}${path}?return_to=${encodeURIComponent(back)}`;
}

function AccountMenu({event, approved}: Required<Pick<Props, "event" | "approved">>) {
    const [open, setOpen] = useState(false);
    const [signOutError, setSignOutError] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();
    const profile = useQuery({
        queryKey: ["event-current-user"], queryFn: getCurrentUser,
        retry: false, refetchOnWindowFocus: false,
    });
    const picture = profilePictureUrl(profile.data?.Picture ?? "");
    const initials = `${profile.data?.FirstName?.trim()?.[0] ?? ""}${profile.data?.LastName?.trim()?.[0] ?? ""}`.toLocaleUpperCase("uk-UA")
        || profile.data?.Email?.trim()?.[0]?.toLocaleUpperCase("uk-UA") || "?";
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
        <PopoverTrigger asChild><button className="event-account__trigger" type="button" aria-label="Меню акаунта" aria-expanded={open}><span className="event-account__avatar" aria-hidden="true">{picture ? (
            // The API returns an origin-specific media URL; this app is statically exported.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture} alt="" width={32} height={32} referrerPolicy="no-referrer" />
        ) : initials}</span></button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="event-account__menu">
            <a href={identityHref("/profile", event)}><UserRound size={16} />Профіль</a>
            {approved && <Link href="/participation" onClick={() => setOpen(false)}><Users size={16} />Моя участь</Link>}
            <div className="event-account__theme"><span>Тема оформлення</span><ThemeToggle /></div>
            <button type="button" onClick={() => void leave()}><LogOut size={16} />Вийти</button>
            {signOutError && <p className="event-account__error" role="alert">Не вдалося вийти. Повторіть спробу.</p>}
        </PopoverContent>
    </Popover>;
}

export function EventHeaderActions({event, authenticated, approved = false}: Pick<Props, "event" | "authenticated" | "approved">) {
    return <>
        <div className="event-header-theme event-header-theme--desktop"><ThemeToggle /></div>
        {authenticated && <>
            <span className="event-header-divider" aria-hidden="true" />
            {approved && <VpnHeaderButton />}
            <NotificationsPopover />
            <AccountMenu event={event} approved={approved} />
        </>}
        {!authenticated && <a className="ib-btn ib-btn--sm ib-btn--ghost ib-navbar__signin" href={identityHref("/sign-in", event)}>Увійти</a>}
    </>;
}

export function EventNavbar({event, authenticated, approved = false, canViewResults = false, pending = false}: Props) {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY);
    const navRef = useRef<HTMLElement>(null);
    const measureRef = useRef<HTMLUListElement>(null);
    const measureMoreRef = useRef<HTMLButtonElement>(null);
    const pages = useQuery({
        queryKey: ["event-navigation-pages", event.EventID, approved],
        queryFn: () => getNavigationPages(event.EventID),
        retry: false, refetchOnWindowFocus: false,
    });
    const managementAccess = useQuery({
        queryKey: ["event-management-access", event.EventID],
        queryFn: () => getManageAccess(event.EventID),
        enabled: authenticated,
        retry: false, refetchOnWindowFocus: false,
    });
    const managedPages = useQuery({
        queryKey: ["event-management-pages", event.EventID],
        queryFn: () => getManagePages(event.EventID),
        enabled: !!managementAccess.data,
        retry: false, refetchOnWindowFocus: false,
    });
    const navigationPages = useMemo(() => managedPages.data
        ? [...managedPages.data].filter(page => page.Navigation !== 0).sort(comparePageOrder)
        : pages.data ?? [], [managedPages.data, pages.data]);
    const links = useMemo(() => pending ? [] : [
        ...navigationPages.filter(page => beforeChallenges(page.NavigationOrder)).map(page => ({href: `/${page.Slug}`, label: page.Title})),
        // Managers check tasks on the same board as the hidden moderators team.
        ...(approved || managementAccess.data?.CanManage ? [{href: "/challenges", label: "Завдання"}] : []),
        ...navigationPages.filter(page => page.NavigationOrder < 0 && !beforeChallenges(page.NavigationOrder)).map(page => ({href: `/${page.Slug}`, label: page.Title})),
        ...((approved ? canViewResults : resultsLinkVisible(resultsAvailability(event))) ? [{href: "/scoreboard", label: "Результати"}] : []),
        ...navigationPages.filter(page => page.NavigationOrder >= 0).map(page => ({href: `/${page.Slug}`, label: page.Title})),
    ], [pending, approved, canViewResults, event, navigationPages, managementAccess.data?.CanManage]);

    useLayoutEffect(() => {
        const nav = navRef.current;
        const measureList = measureRef.current;
        const measureMore = measureMoreRef.current;
        if (!nav || !measureList || !measureMore) return;
        const measure = () => {
            if (!nav.clientWidth) return;
            const widths = Array.from(measureList.children, item => (item as HTMLElement).offsetWidth);
            const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 2;
            if (total <= nav.clientWidth) {
                setVisibleCount(widths.length);
                setMoreOpen(false);
                return;
            }
            const room = Math.max(0, nav.clientWidth - measureMore.offsetWidth - 2);
            let used = 0;
            let count = 0;
            for (const width of widths) {
                if (used + width > room) break;
                used += width + 2;
                count++;
            }
            setVisibleCount(count);
        };
        const frame = requestAnimationFrame(measure);
        const observer = new ResizeObserver(measure);
        observer.observe(nav);
        void document.fonts?.ready.then(measure);
        return () => { cancelAnimationFrame(frame); observer.disconnect(); };
    }, [links]);

    const overflow = links.slice(visibleCount);
    return <header className={`ib-navbar event-navbar${open ? " is-open" : ""}`} aria-busy={pending || undefined}>
        <div className="ib-navbar__bar">
            <Link className="ib-navbar__brand" href="/" aria-label={`${event.Name}, головна події`} onClick={() => setOpen(false)}>
                <EventBrandLogo event={event} className="ib-navbar__crest" />
                <span className="ib-navbar__name">{event.Name}</span>
            </Link>
            <nav className="ib-navbar__nav" aria-label="Розділи події" ref={navRef}>
                <ul className="ib-navbar__tabs">{links.slice(0, visibleCount).map(link => <li key={link.href}><Link className="ib-navbar__link" href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link></li>)}</ul>
                {overflow.length > 0 && <div className="ib-navbar__more"><Popover open={moreOpen} onOpenChange={setMoreOpen}><PopoverTrigger asChild><button className={`ib-navbar__more-btn${overflow.some(link => path === link.href) ? " is-current" : ""}`} type="button">Ще <ChevronDown className="ib-icon" /></button></PopoverTrigger><PopoverContent align="start" sideOffset={4} className="event-navbar__more-menu">{overflow.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} onClick={() => setMoreOpen(false)}>{link.label}</Link>)}</PopoverContent></Popover></div>}
                <ul className="ib-navbar__tabs event-navbar__measure" ref={measureRef} aria-hidden="true">{links.map(link => <li key={link.href}><span className="ib-navbar__link">{link.label}</span></li>)}</ul>
                <button className="ib-navbar__more-btn event-navbar__more-measure" type="button" ref={measureMoreRef} tabIndex={-1} aria-hidden="true">Ще <ChevronDown className="ib-icon" /></button>
            </nav>
            <div className="ib-navbar__actions">
                {pending ? <div className="event-header-theme event-header-theme--desktop"><ThemeToggle /></div> : <>
                {authenticated && <ManagerEntry eventID={event.EventID} variant="nav" />}
                <EventHeaderActions event={event} authenticated={authenticated} approved={approved} />
                </>}
                {!pending && <button className="ib-navbar__toggle" type="button" aria-expanded={open} aria-controls="event-menu" aria-label={open ? "Закрити меню" : "Відкрити меню"} onClick={() => setOpen(value => !value)}>{open ? <X size={20} /> : <Menu size={20} />}</button>}
            </div>
        </div>
        <nav className="ib-navbar__panel" id="event-menu" aria-label="Мобільне меню">
            {links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
            {authenticated && <ManagerEntry eventID={event.EventID} variant="panel" />}
            {!authenticated && <div className="event-navbar__mobile-theme"><span>Тема оформлення</span><ThemeToggle /></div>}
        </nav>
    </header>;
}
