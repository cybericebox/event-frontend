"use client";

import {Fragment, useEffect, useState, type RefObject} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bell,
  BellRing,
  Cog,
  FileDown,
  Flag,
  Handshake,
  LayoutTemplate,
  ListChecks,
  Medal,
  Target,
  UserSearch,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Gauge,
  ShieldCheck,
  TrendingUp,
  ChevronDown,
  FilePenLine,
  FileText,
  Layers3,
  LayoutDashboard,
  Mail,
  Megaphone,
  MonitorPlay,
  Palette,
  Plus,
  ScrollText,
  Send,
  Server,
  Settings,
  Settings2,
  SlidersHorizontal,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
  Puzzle,
  Cpu,
  Container,
  MessagesSquare,
  MailCheck,
} from "lucide-react";
import type {ManagePage} from "@/api/manage";
import type {AnalyticsAccess} from "@/api/manageAnalytics";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventBrandLogo} from "../EventBrandLogo";
import {comparePageOrder} from "../content/pageNavigationOrder";
import {t} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {readAdminReturn} from "@/utils/returnOrigin";
import {adminOrigin} from "@/utils/origins";

type Item = {dividerBefore?: boolean; href: string; label: string; icon: LucideIcon; teamsOnly?: boolean; infrastructureOnly?: boolean; sensitiveOnly?: boolean};
type Group = {id: string; label: string; icon: LucideIcon; items: Item[]};

// Пауза: повернути до навігації, коли зʼявиться механізм призупинення заходу.
const groups: Group[] = [
    {id: "event", label: t("manage.nav.group.event"), icon: Flag, items: [
        {href: "/manage/settings", label: t("manage.nav.settings"), icon: Settings2},
        {href: "/manage/appearance", label: t("manage.nav.appearance"), icon: Palette},
        {href: "/manage/participation-settings", label: t("manage.nav.participationSettings"), icon: UsersRound},
        {href: "/manage/schedule", label: t("manage.nav.schedule"), icon: CalendarDays},
    ]},
    {id: "participation", label: t("manage.nav.group.participation"), icon: Handshake, items: [
        {href: "/manage/registration", label: t("manage.nav.registration"), icon: FilePenLine},
        {href: "/manage/participants", label: t("manage.nav.participants"), icon: UserRound},
        {href: "/manage/teams", label: t("manage.nav.teams"), icon: Users, teamsOnly: true},
    ]},
    {id: "challenges", label: t("manage.nav.group.challenges"), icon: Target, items: [
        {href: "/manage/challenge-settings", label: t("manage.nav.challengeSettings"), icon: SlidersHorizontal},
        {href: "/manage/exercise-groups", label: t("manage.nav.exerciseGroups"), icon: Layers3},
        {href: "/manage/exercises", label: t("manage.nav.exercises"), icon: Puzzle},
        {href: "/manage/labs", label: t("manage.nav.labs"), icon: Server, infrastructureOnly: true},
        {href: "/manage/resources", label: t("manage.nav.resources"), icon: Cpu, infrastructureOnly: true},
        {href: "/manage/submissions", label: t("manage.nav.submissions"), icon: ListChecks},
    ]},
    {id: "pages", label: t("manage.nav.pages"), icon: LayoutTemplate, items: [
        {href: "/manage/content/landing", label: t("manage.nav.landing"), icon: FileText},
    ]},
    {id: "results", label: t("manage.nav.group.results"), icon: Medal, items: [
        {href: "/manage/results-settings", label: t("manage.nav.resultsSettings"), icon: Cog},
        {href: "/manage/results", label: t("manage.nav.results"), icon: Trophy},
        {href: "/manage/live", label: t("manage.nav.live"), icon: MonitorPlay},
    ]},
    // Shown only to the viewers with analytics access (§7); «Стенди» needs infrastructure, «Доброчесність» the sensitive level.
    {id: "analytics", label: t("manage.nav.group.analytics"), icon: ChartNoAxesCombined, items: [
        {href: "/manage/analytics", label: t("manage.nav.analyticsOverview"), icon: Gauge},
        {href: "/manage/analytics/participants", label: t("manage.nav.analytics.participants"), icon: UserSearch},
        {href: "/manage/analytics/tasks", label: t("manage.nav.analytics.tasks"), icon: ClipboardList},
        {href: "/manage/analytics/progress", label: t("manage.nav.analytics.progress"), icon: TrendingUp},
        {href: "/manage/analytics/stands", label: t("manage.nav.analytics.stands"), icon: Container, infrastructureOnly: true},
        {href: "/manage/analytics/usage", label: t("manage.nav.analytics.usage"), icon: Activity, infrastructureOnly: true},
        {href: "/manage/analytics/integrity", label: t("manage.nav.analytics.integrity"), icon: ShieldCheck, sensitiveOnly: true},
        {href: "/manage/analytics/communications", label: t("manage.nav.analytics.communications"), icon: MessagesSquare},
        {href: "/manage/analytics/report", label: t("manage.nav.analytics.report"), icon: FileDown},
    ]},
    // Three blocks split by thin dividers: actions, settings (templates + notification settings), log.
    {id: "notifications", label: t("manage.nav.group.notifications"), icon: Bell, items: [
        {href: "/manage/broadcasts", label: t("manage.nav.broadcasts"), icon: Send},
        {href: "/manage/banners", label: t("manage.nav.banners"), icon: Megaphone},
        {href: "/manage/notifications", label: t("manage.nav.notificationsOnSite"), icon: BellRing, dividerBefore: true},
        {href: "/manage/email", label: t("manage.nav.emailTemplates"), icon: Mail},
        {href: "/manage/mail", label: t("manage.nav.mail"), icon: MailCheck},
        {href: "/manage/mail-journal", label: t("manage.nav.mailJournal"), icon: ScrollText, dividerBefore: true},
    ]},
];

const itemHrefs = groups.flatMap(group => group.items.map(item => item.href));
const within = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// An item is current on its own address and below it, unless a longer item address matches better
// («Огляд» analytics is not current on «Учасники» analytics).
function isCurrent(pathname: string, href: string) {
    return within(pathname, href) && !itemHrefs.some(other => other.length > href.length && within(pathname, other));
}

// A cut-off label shows its full text (and page state) in our tooltip on hover.
function SideLabel({text, hint = text}: {text: string; hint?: string}) {
    return <EventTooltip content={hint} className="event-manage-sidebar__tip" truncated>{() => <span className="ib-admin-side__label">{text}</span>}</EventTooltip>;
}

export function ManagerSidebar({asideRef, drawerOpen = false, event, pathname, pages, pagesError, canManage, platformStaff = false, infrastructureAllowed, analytics, onRetryPages, onNavigate}: {
    asideRef?: RefObject<HTMLElement | null>;
    // Narrow screens show the sidebar as a modal drawer.
    drawerOpen?: boolean;
    event: PublicEventInfo;
    pathname: string;
    pages?: ManagePage[];
    pagesError: boolean;
    canManage: boolean;
    // Platform staff see the way back to the platform panel even without a `?from=`.
    platformStaff?: boolean;
    infrastructureAllowed: boolean;
    // What the viewer may see of the analytics; without it the group is hidden.
    analytics?: AnalyticsAccess;
    onRetryPages: () => void;
    onNavigate: () => void;
}) {
    // The group holding the current page starts open; the reader can open others.
    const [openGroupID, setOpenGroupID] = useState<string | null>(() => groups.find(group => group.items.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`)))?.id ?? null);
    const teamMode = event.Participation === 1;
    const showItem = (item: Item) => (!item.teamsOnly || teamMode) && (!item.infrastructureOnly || infrastructureAllowed) && (!item.sensitiveOnly || !!analytics?.Sensitive);
    const openGroup = (groupID: string) => setOpenGroupID(groupID);
    // Set when the user came from the platform admin (a validated `?from=`, kept for the session).
    const [adminReturn, setAdminReturn] = useState<string | null>(null);
    useEffect(() => {
        let storage: Storage | null = null;
        try {storage = window.sessionStorage;} catch { /* Blocked storage: only the address counts. */ }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, unknown on the server
        setAdminReturn(readAdminReturn(window.location.search, storage));
    }, []);

    const platformHref = adminReturn ?? (platformStaff && adminOrigin ? adminOrigin : null);

    return <aside ref={asideRef} className="ib-admin-side ib-mass" aria-label={t("manage.nav.eventManagement")} role={drawerOpen ? "dialog" : undefined} aria-modal={drawerOpen ? true : undefined}>
        <div className="ib-admin-side__head">
            <Link href="/" className="event-manage-brand" aria-label={t("manage.shell.toEventSiteHint")}><EventBrandLogo event={event} className="ib-admin-side__crest" /><div className="ib-admin-side__title"><b>{event.Name}</b><small>{t("manage.nav.eventManagement")}</small></div></Link>
            <EventTooltip content={t("manage.shell.closeMenu")} silent>{() => <button className="ib-admin-side__close" type="button" aria-label={t("manage.shell.closeMenu")} onClick={onNavigate}><X size={18} /></button>}</EventTooltip>
        </div>
        <nav className="ib-admin-side__nav" aria-label={t("manage.nav.sections")}>
            <Link className="ib-admin-side__item" href="/manage" aria-current={pathname === "/manage" ? "page" : undefined} onClick={onNavigate}><LayoutDashboard size={16} aria-hidden="true" /><span className="ib-admin-side__label">{t("manage.nav.overview")}</span></Link>
            {groups.filter(group => group.id !== "analytics" || analytics?.Sections).map(group => {
                const isOpen = openGroupID === group.id;
                const items = group.items.filter(showItem);
                return <section className="ib-admin-side__section" key={group.id}>
                    <button className="ib-admin-side__item ib-admin-side__heading" type="button" aria-expanded={isOpen} aria-controls={`event-manage-group-${group.id}`} onClick={() => setOpenGroupID(current => current === group.id ? null : group.id)}>
                        <group.icon size={16} aria-hidden="true" /><span className="ib-admin-side__label">{group.label}</span><ChevronDown size={15} aria-hidden="true" />
                    </button>
                    <div id={`event-manage-group-${group.id}`} className="ib-admin-side__items" hidden={!isOpen}>
                        {items.map(item => <Fragment key={item.href}>
                            {item.dividerBefore && <hr className="ib-admin-side__divider" />}
                            <Link className="ib-admin-side__item" href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined} onClick={() => {openGroup(group.id); onNavigate();}}><item.icon size={16} aria-hidden="true" /><SideLabel text={item.label} /></Link>
                        </Fragment>)}
                        {group.id === "pages" && <>
                            {[...(pages ?? [])].sort(comparePageOrder).map(page => {
                                const editorSlug = page.Draft?.Slug ?? page.Slug;
                                const title = page.Draft?.Title ?? page.Title;
                                const state = !page.PublishedAt ? t("manage.nav.page.unpublished") : page.Draft ? t("manage.nav.page.unpublishedChanges") : "";
                                return <Link className="ib-admin-side__item" key={page.ID} href={`/manage/content/pages/${editorSlug}`} aria-current={pathname === `/manage/content/pages/${editorSlug}` ? "page" : undefined} onClick={() => {openGroup("pages"); onNavigate();}}><FileText size={16} aria-hidden="true" /><SideLabel text={title} hint={state ? t("manage.nav.page.titleWithState", {title, state}) : title} />{state && <span className="ib-admin-side__draft">{page.PublishedAt ? t("manage.nav.page.draftBadge") : t("manage.nav.page.unpublishedBadge")}</span>}</Link>;
                            })}
                            {pagesError && <div className="event-manage-sidebar__error" role="alert">{t("manage.nav.pagesUnavailable")} <button type="button" onClick={onRetryPages}>{t("common.retry")}</button></div>}
                            {canManage && <Link className="ib-admin-side__item event-manage-sidebar__add" href="/manage/content/pages/new" aria-current={pathname === "/manage/content/pages/new" ? "page" : undefined} onClick={() => {openGroup("pages"); onNavigate();}}><Plus size={16} aria-hidden="true" /><span className="ib-admin-side__label">{t("manage.nav.addPage")}</span></Link>}
                        </>}
                    </div>
                </section>;
            })}
        </nav>
        <div className="ib-admin-side__foot">
            {platformHref && <EventTooltip content={t("manage.nav.returnToAdminHint")} silent>{() => <a className="ib-admin-side__item" href={platformHref} aria-label={t("manage.nav.returnToAdminHint")}><Settings size={16} aria-hidden="true" /><span className="ib-admin-side__label">{t("manage.nav.returnToAdmin")}</span></a>}</EventTooltip>}
            <EventTooltip content={t("manage.shell.toEventSiteHint")} silent>{() => <Link className="ib-admin-side__item" href="/" aria-label={t("manage.shell.toEventSiteHint")} onClick={onNavigate}><ArrowLeft size={16} aria-hidden="true" /><span className="ib-admin-side__label">{t("manage.shell.toEventSite")}</span></Link>}</EventTooltip></div>
    </aside>;
}
