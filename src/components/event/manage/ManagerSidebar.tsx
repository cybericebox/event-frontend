"use client";

import {useState} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AtSign,
  Bell,
  CalendarDays,
  ChevronDown,
  FilePenLine,
  FileText,
  Layers3,
  LayoutDashboard,
  Mail,
  MonitorPlay,
  Palette,
  Plus,
  Send,
  Server,
  Settings2,
  SlidersHorizontal,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
  Puzzle,
} from "lucide-react";
import type {ManagePage} from "@/api/manage";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventBrandLogo} from "../EventBrandLogo";
import {comparePageOrder} from "../content/pageNavigationOrder";
import "./managerSidebar.css";
import {t} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";

type Item = {href: string; label: string; icon: LucideIcon; teamsOnly?: boolean; infrastructureOnly?: boolean};
type Group = {id: string; label: string; items: Item[]};

// Пауза: повернути до навігації, коли з'явиться механізм призупинення заходу.
const groups: Group[] = [
    {id: "event", label: t("manage.nav.group.event"), items: [
        {href: "/manage/settings", label: t("manage.nav.settings"), icon: Settings2},
        {href: "/manage/appearance", label: t("manage.nav.appearance"), icon: Palette},
        {href: "/manage/participation-settings", label: t("manage.nav.participationSettings"), icon: UsersRound},
        {href: "/manage/schedule", label: t("manage.nav.schedule"), icon: CalendarDays},
    ]},
    {id: "participation", label: t("manage.nav.group.participation"), items: [
        {href: "/manage/registration", label: t("manage.nav.registration"), icon: FilePenLine},
        {href: "/manage/participants", label: t("manage.nav.participants"), icon: UserRound},
        {href: "/manage/teams", label: t("manage.nav.teams"), icon: Users, teamsOnly: true},
    ]},
    {id: "challenges", label: t("manage.nav.group.challenges"), items: [
        {href: "/manage/challenge-settings", label: t("manage.nav.challengeSettings"), icon: SlidersHorizontal},
        {href: "/manage/exercise-groups", label: t("manage.nav.exerciseGroups"), icon: Layers3},
        {href: "/manage/exercises", label: t("manage.nav.exercises"), icon: Puzzle},
        {href: "/manage/labs", label: t("manage.nav.labs"), icon: Server, infrastructureOnly: true},
        {href: "/manage/submissions", label: t("manage.nav.submissions"), icon: Send},
    ]},
    {id: "pages", label: t("manage.nav.pages"), items: [
        {href: "/manage/content/landing", label: t("manage.nav.landing"), icon: FileText},
    ]},
    {id: "results", label: t("manage.nav.group.results"), items: [
        {href: "/manage/results-settings", label: t("manage.nav.resultsSettings"), icon: SlidersHorizontal},
        {href: "/manage/results", label: t("manage.nav.results"), icon: Trophy},
        {href: "/manage/live", label: t("manage.nav.live"), icon: MonitorPlay},
    ]},
    {id: "notifications", label: t("manage.nav.group.notifications"), items: [
        {href: "/manage/notifications", label: t("manage.nav.notificationsOnSite"), icon: Bell},
        {href: "/manage/email", label: t("manage.nav.email"), icon: Mail},
        {href: "/manage/mail", label: t("manage.nav.mail"), icon: AtSign},
    ]},
];

// A cut-off label shows its full text (and page state) in our tooltip on hover.
function SideLabel({text, hint = text}: {text: string; hint?: string}) {
    return <EventTooltip content={hint} className="event-manage-sidebar__tip" truncated>{() => <span className="ib-admin-side__label">{text}</span>}</EventTooltip>;
}

export function ManagerSidebar({event, pathname, pages, pagesError, canManage, infrastructureAllowed, onRetryPages, onNavigate}: {
    event: PublicEventInfo;
    pathname: string;
    pages?: ManagePage[];
    pagesError: boolean;
    canManage: boolean;
    infrastructureAllowed: boolean;
    onRetryPages: () => void;
    onNavigate: () => void;
}) {
    const [openGroupID, setOpenGroupID] = useState<string | null>(null);
    const teamMode = event.Participation === 1;
    const showItem = (item: Item) => (!item.teamsOnly || teamMode) && (!item.infrastructureOnly || infrastructureAllowed);
    const openGroup = (groupID: string) => setOpenGroupID(groupID);

    return <aside className="ib-admin-side ib-mass" aria-label={t("manage.nav.eventManagement")}>
        <div className="ib-admin-side__head">
            <Link href="/" className="event-manage-brand" aria-label={t("manage.shell.toEventSite")}><EventBrandLogo event={event} className="ib-admin-side__crest" /><div className="ib-admin-side__title"><b>{event.Name}</b><small>{t("manage.nav.eventManagement")}</small></div></Link>
            <button className="ib-admin-side__close" type="button" aria-label={t("manage.shell.closeMenu")} onClick={onNavigate}><X size={18} /></button>
        </div>
        <nav className="ib-admin-side__nav" aria-label={t("manage.nav.sections")}>
            <Link className="ib-admin-side__item event-manage-sidebar__overview" href="/manage" aria-current={pathname === "/manage" ? "page" : undefined} onClick={onNavigate}><LayoutDashboard size={16} aria-hidden="true" /><span className="ib-admin-side__label">{t("manage.nav.overview")}</span></Link>
            {groups.map(group => {
                const isOpen = openGroupID === group.id;
                const items = group.items.filter(showItem);
                return <section className="event-manage-sidebar__group" key={group.id} aria-label={group.label}>
                    <button className="event-manage-sidebar__heading" type="button" aria-expanded={isOpen} aria-controls={`event-manage-group-${group.id}`} onClick={() => setOpenGroupID(current => current === group.id ? null : group.id)}>
                        <span>{group.label}</span><ChevronDown size={15} aria-hidden="true" />
                    </button>
                    <div id={`event-manage-group-${group.id}`} className="event-manage-sidebar__items" hidden={!isOpen}>
                        {items.map(item => <Link className="ib-admin-side__item" href={item.href} key={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => {openGroup(group.id); onNavigate();}}><item.icon size={16} aria-hidden="true" /><SideLabel text={item.label} /></Link>)}
                        {group.id === "pages" && <>
                            {[...(pages ?? [])].sort(comparePageOrder).map(page => {
                                const editorSlug = page.Draft?.Slug ?? page.Slug;
                                const title = page.Draft?.Title ?? page.Title;
                                const state = !page.PublishedAt ? t("manage.nav.page.unpublished") : page.Draft ? t("manage.nav.page.unpublishedChanges") : "";
                                return <Link className="ib-admin-side__item event-manage-sidebar__page" key={page.ID} href={`/manage/content/pages/${editorSlug}`} aria-current={pathname === `/manage/content/pages/${editorSlug}` ? "page" : undefined} onClick={() => {openGroup("pages"); onNavigate();}}><FileText size={16} aria-hidden="true" /><SideLabel text={title} hint={state ? t("manage.nav.page.titleWithState", {title, state}) : title} />{state && <span className="event-manage-sidebar__draft">{page.PublishedAt ? t("manage.nav.page.draftBadge") : t("manage.nav.page.unpublishedBadge")}</span>}</Link>;
                            })}
                            {pagesError && <div className="event-manage-sidebar__error" role="alert">{t("manage.nav.pagesUnavailable")} <button type="button" onClick={onRetryPages}>{t("common.retry")}</button></div>}
                            {canManage && <Link className="ib-admin-side__item event-manage-sidebar__add" href="/manage/content/pages/new" aria-current={pathname === "/manage/content/pages/new" ? "page" : undefined} onClick={() => {openGroup("pages"); onNavigate();}}><Plus size={16} aria-hidden="true" /><span className="ib-admin-side__label">{t("manage.nav.addPage")}</span></Link>}
                        </>}
                    </div>
                </section>;
            })}
        </nav>
        <div className="ib-admin-side__foot"><Link className="ib-admin-side__item" href="/" onClick={onNavigate}><ArrowLeft size={16} aria-hidden="true" /><span className="ib-admin-side__label">{t("manage.shell.toEventSite")}</span></Link></div>
    </aside>;
}
