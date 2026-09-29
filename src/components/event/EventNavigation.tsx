"use client";

import {Fragment, useLayoutEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ChevronDown, Menu, Users, X} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {getNavigationPages} from "@/api/navigationPages";
import {getManageAccess, getManagePages} from "@/api/manage";
import {signOut} from "@/api/authAPI";
import {getCatalogAccess, getCurrentUser, profilePictureUrl} from "@/api/clientAuth";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {EventBrandLogo} from "./EventBrandLogo";
import {ThemeToggle} from "./ThemeToggle";
import {VpnHeaderButton} from "./vpn/EventVpn";
import {ManagerEntry} from "./manage/ManagerEntry";
import {InboxButton} from "./InboxButton";
import {beforeChallenges, comparePageOrder} from "./content/pageNavigationOrder";
import {resultsAvailability, resultsLinkVisible} from "@/types/resultsAvailability";
import {adminOrigin, eventOrigin, exercisesOrigin, idOrigin, mainOrigin} from "@/utils/origins";
import {ACCOUNT_MENU_ICON_PROPS, ACCOUNT_MENU_ICONS, ACCOUNT_MENU_LABELS, accountMenu} from "@/utils/accountMenu";
import {openConsentSettings} from "@/utils/consent";
import {COOKIE_POLICY_HREF} from "@/components/consent/CookieSettingsLink";
import {t} from "@/i18n/t";
import {initials} from "@/utils/initials";

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
    const back = eventOrigin(event.Tag);
    if (!idOrigin || !back) return "/";
    return `${idOrigin}${path}?return_to=${encodeURIComponent(`${back}/`)}`;
}

// Unified account menu (utils/accountMenu): same entries, labels and icons in every app;
// the event's own items follow the platform links.

function AccountMenu({event, approved}: Required<Pick<Props, "event" | "approved">>) {
    const [open, setOpen] = useState(false);
    const [signOutError, setSignOutError] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();
    const profile = useQuery({
        queryKey: ["event-current-user"], queryFn: getCurrentUser,
        retry: false, refetchOnWindowFocus: false,
    });
    const adminTier = !!profile.data && profile.data.Role !== "user";
    const catalog = useQuery({
        queryKey: ["event-catalog-access"], queryFn: getCatalogAccess,
        enabled: !!profile.data && !adminTier,
        retry: false, refetchOnWindowFocus: false,
    });
    const entries = accountMenu("event", {
        adminTier, catalog: adminTier || catalog.data === true,
        returnTo: typeof window !== "undefined" ? window.location.href : `${eventOrigin(event.Tag)}/`,
    }, {id: idOrigin, admin: adminOrigin, exercises: exercisesOrigin, main: mainOrigin});
    const contextAt = entries.findIndex(entry => entry.kind === "divider");
    const picture = profilePictureUrl(profile.data?.Picture ?? "");
    const avatarInitials = initials(profile.data?.FirstName, profile.data?.LastName, profile.data?.Email);
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
        <PopoverTrigger asChild><button className="event-account__trigger" type="button" aria-label={t("account.menu")} aria-expanded={open}><span className="event-account__avatar" aria-hidden="true">{picture ? (
            // The API returns an origin-specific media URL; this app is statically exported.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture} alt="" width={32} height={32} referrerPolicy="no-referrer" />
        ) : avatarInitials}</span></button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="event-account__menu">
            {entries.map((entry, i) => {
                if (entry.kind === "divider") return <Fragment key={i}>
                    {/* The event context sits right after the platform links. */}
                    {i === contextAt && <>
                        {approved && <Link href="/participation" onClick={() => setOpen(false)}><Users {...ACCOUNT_MENU_ICON_PROPS} />{t("account.participation")}</Link>}
                        <div className="event-account__theme"><span>{t("theme.label")}</span><ThemeToggle /></div>
                    </>}
                    <hr className="event-account__sep" />
                </Fragment>;
                if (entry.kind === "cookies") {
                    const Icon = ACCOUNT_MENU_ICONS.cookies;
                    // A link to the cookie policy; with JS the menu closes and the consent panel opens instead.
                    return <a key={i} href={COOKIE_POLICY_HREF} aria-label={t(ACCOUNT_MENU_LABELS.cookiesAria)} onClick={e => {
                        e.preventDefault();
                        setOpen(false);
                        window.setTimeout(openConsentSettings, 0);
                    }}><Icon {...ACCOUNT_MENU_ICON_PROPS} />{t(ACCOUNT_MENU_LABELS.cookies)}</a>;
                }
                if (entry.kind === "signOut") {
                    const Icon = ACCOUNT_MENU_ICONS.signOut;
                    return <button key={i} type="button" onClick={() => void leave()}><Icon {...ACCOUNT_MENU_ICON_PROPS} />{t(ACCOUNT_MENU_LABELS.signOut)}</button>;
                }
                const Icon = ACCOUNT_MENU_ICONS[entry.key];
                return <a key={entry.key} href={entry.href}><Icon {...ACCOUNT_MENU_ICON_PROPS} />{t(ACCOUNT_MENU_LABELS[entry.key])}</a>;
            })}
            {signOutError && <p className="event-account__error" role="alert">{t("account.signOutFailed")}</p>}
        </PopoverContent>
    </Popover>;
}

export function EventHeaderActions({event, authenticated, approved = false}: Pick<Props, "event" | "authenticated" | "approved">) {
    // Managers land on «Запити» in /manage; participants see «Усі».
    const manage = /^\/manage(\/|$)/.test(usePathname() ?? "");
    return <>
        <div className="event-header-theme event-header-theme--desktop"><ThemeToggle /></div>
        {authenticated && <>
            <span className="event-header-divider" aria-hidden="true" />
            {approved && <VpnHeaderButton />}
            <InboxButton defaultTab={manage ? "requests" : "all"} event={{id: event.EventID, otherEventsHref: `${mainOrigin}/?inbox`}} />
            <AccountMenu event={event} approved={approved} />
        </>}
        {!authenticated && <a className="ib-btn ib-btn--sm ib-btn--ghost ib-navbar__signin" href={identityHref("/sign-in", event)}>{t("account.signIn")}</a>}
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
        ? [...managedPages.data].filter(page => page.PublishedAt && page.Navigation !== 0).sort(comparePageOrder)
        : pages.data ?? [], [managedPages.data, pages.data]);
    const links = useMemo(() => pending ? [] : [
        ...navigationPages.filter(page => beforeChallenges(page.NavigationOrder)).map(page => ({href: `/${page.Slug}`, label: page.Title})),
        // Managers check tasks on the same board as the hidden moderators team.
        ...(approved || managementAccess.data?.CanManage ? [{href: "/challenges", label: t("nav.challenges")}] : []),
        ...navigationPages.filter(page => page.NavigationOrder < 0 && !beforeChallenges(page.NavigationOrder)).map(page => ({href: `/${page.Slug}`, label: page.Title})),
        ...((approved ? canViewResults : resultsLinkVisible(resultsAvailability(event))) ? [{href: "/scoreboard", label: t("nav.results")}] : []),
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
            <Link className="ib-navbar__brand" href="/" aria-label={t("nav.brand", {name: event.Name})} onClick={() => setOpen(false)}>
                <EventBrandLogo event={event} className="ib-navbar__crest" />
                <span className="ib-navbar__name">{event.Name}</span>
            </Link>
            <nav className="ib-navbar__nav" aria-label={t("nav.sections")} ref={navRef}>
                <ul className="ib-navbar__tabs">{links.slice(0, visibleCount).map(link => <li key={link.href}><Link className="ib-navbar__link" href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link></li>)}</ul>
                {overflow.length > 0 && <div className="ib-navbar__more"><Popover open={moreOpen} onOpenChange={setMoreOpen}><PopoverTrigger asChild><button className={`ib-navbar__more-btn${overflow.some(link => path === link.href) ? " is-current" : ""}`} type="button">{t("nav.more")} <ChevronDown className="ib-icon" /></button></PopoverTrigger><PopoverContent align="start" sideOffset={4} className="event-navbar__more-menu">{overflow.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} onClick={() => setMoreOpen(false)}>{link.label}</Link>)}</PopoverContent></Popover></div>}
                <ul className="ib-navbar__tabs event-navbar__measure" ref={measureRef} aria-hidden="true">{links.map(link => <li key={link.href}><span className="ib-navbar__link">{link.label}</span></li>)}</ul>
                <button className="ib-navbar__more-btn event-navbar__more-measure" type="button" ref={measureMoreRef} tabIndex={-1} aria-hidden="true">{t("nav.more")} <ChevronDown className="ib-icon" /></button>
            </nav>
            <div className="ib-navbar__actions">
                {pending ? <div className="event-header-theme event-header-theme--desktop"><ThemeToggle /></div> : <>
                {authenticated && <ManagerEntry eventID={event.EventID} variant="nav" />}
                <EventHeaderActions event={event} authenticated={authenticated} approved={approved} />
                </>}
                {!pending && <button className="ib-navbar__toggle" type="button" aria-expanded={open} aria-controls="event-menu" aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")} onClick={() => setOpen(value => !value)}>{open ? <X size={20} /> : <Menu size={20} />}</button>}
            </div>
        </div>
        <nav className="ib-navbar__panel" id="event-menu" aria-label={t("nav.mobile")}>
            {links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
            {authenticated && <ManagerEntry eventID={event.EventID} variant="panel" />}
            {!authenticated && <div className="event-navbar__mobile-theme"><span>{t("theme.label")}</span><ThemeToggle /></div>}
        </nav>
    </header>;
}
