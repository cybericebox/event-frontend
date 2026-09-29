"use client";

import {useState} from "react";
import Link from "next/link";
import {
    ArrowLeft, AtSign, Bell, CalendarDays, ChevronDown,
    FilePenLine, FileText, Flag, Layers3, LayoutDashboard,
    Mail, MonitorPlay, Palette, Plus, Send, Server, Settings2,
    SlidersHorizontal, Trophy, UserRound, Users, UsersRound, X,
    type LucideIcon,
} from "lucide-react";
import type {ManagePage} from "@/api/manage";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventBrandLogo} from "../EventBrandLogo";
import {comparePageOrder} from "../content/pageNavigationOrder";
import "./managerSidebar.css";

type Item = {href: string; label: string; icon: LucideIcon; teamsOnly?: boolean; infrastructureOnly?: boolean};
type Group = {id: string; label: string; items: Item[]};

// Пауза: повернути до навігації, коли з'явиться механізм призупинення події.
const groups: Group[] = [
    {id: "event", label: "Подія", items: [
        {href: "/manage/settings", label: "Загальне", icon: Settings2},
        {href: "/manage/appearance", label: "Вигляд", icon: Palette},
        {href: "/manage/participation-settings", label: "Формат участі", icon: UsersRound},
        {href: "/manage/schedule", label: "Публікація і час", icon: CalendarDays},
    ]},
    {id: "participation", label: "Участь", items: [
        {href: "/manage/registration", label: "Реєстрація", icon: FilePenLine},
        {href: "/manage/participants", label: "Учасники", icon: UserRound},
        {href: "/manage/teams", label: "Команди", icon: Users, teamsOnly: true},
    ]},
    {id: "challenges", label: "Завдання", items: [
        {href: "/manage/exercise-groups", label: "Групи й порядок", icon: Layers3},
        {href: "/manage/exercises", label: "Завдання", icon: Flag},
        {href: "/manage/labs", label: "Стенди", icon: Server, infrastructureOnly: true},
        {href: "/manage/scoring", label: "Профіль балів", icon: SlidersHorizontal},
        {href: "/manage/submissions", label: "Спроби розв’язання", icon: Send},
    ]},
    {id: "pages", label: "Сторінки", items: [
        {href: "/manage/content/landing", label: "Головна сторінка", icon: FileText},
    ]},
    {id: "results", label: "Результати", items: [
        {href: "/manage/results-settings", label: "Налаштування результатів", icon: SlidersHorizontal},
        {href: "/manage/results", label: "Таблиця результатів", icon: Trophy},
        {href: "/manage/live", label: "Live", icon: MonitorPlay},
    ]},
    {id: "notifications", label: "Сповіщення", items: [
        {href: "/manage/notifications", label: "На сайті", icon: Bell},
        {href: "/manage/email", label: "Електронні листи", icon: Mail},
        {href: "/manage/mail", label: "Пошта", icon: AtSign},
    ]},
];

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

    return <aside className="ib-admin-side ib-mass" aria-label="Керування подією">
        <div className="ib-admin-side__head">
            <Link href="/" className="event-manage-brand" aria-label="На сайт події"><EventBrandLogo event={event} className="ib-admin-side__crest" /><div className="ib-admin-side__title"><b>{event.Name}</b><small>Керування подією</small></div></Link>
            <button className="ib-admin-side__close" type="button" aria-label="Закрити меню" onClick={onNavigate}><X size={18} /></button>
        </div>
        <nav className="ib-admin-side__nav" aria-label="Розділи керування">
            <Link className="ib-admin-side__item event-manage-sidebar__overview" href="/manage" aria-current={pathname === "/manage" ? "page" : undefined} onClick={onNavigate}><LayoutDashboard size={16} aria-hidden="true" /><span className="ib-admin-side__label">Огляд і підготовка</span></Link>
            {groups.map(group => {
                const isOpen = openGroupID === group.id;
                const items = group.items.filter(showItem);
                return <section className="event-manage-sidebar__group" key={group.id} aria-label={group.label}>
                    <button className="event-manage-sidebar__heading" type="button" aria-expanded={isOpen} aria-controls={`event-manage-group-${group.id}`} onClick={() => setOpenGroupID(current => current === group.id ? null : group.id)}>
                        <span>{group.label}</span><ChevronDown size={15} aria-hidden="true" />
                    </button>
                    <div id={`event-manage-group-${group.id}`} className="event-manage-sidebar__items" hidden={!isOpen}>
                        {items.map(item => <Link className="ib-admin-side__item" href={item.href} key={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => {openGroup(group.id); onNavigate();}} title={item.label}><item.icon size={16} aria-hidden="true" /><span className="ib-admin-side__label">{item.label}</span></Link>)}
                        {group.id === "pages" && <>
                            {[...(pages ?? [])].sort(comparePageOrder).map(page => <Link className="ib-admin-side__item event-manage-sidebar__page" key={page.ID} href={`/manage/content/pages/${page.Slug}`} aria-current={pathname === `/manage/content/pages/${page.Slug}` ? "page" : undefined} onClick={() => {openGroup("pages"); onNavigate();}} title={page.Title}><FileText size={16} aria-hidden="true" /><span className="ib-admin-side__label">{page.Title}</span></Link>)}
                            {pagesError && <div className="event-manage-sidebar__error" role="alert">Сторінки недоступні. <button type="button" onClick={onRetryPages}>Повторити</button></div>}
                            {canManage && <Link className="ib-admin-side__item event-manage-sidebar__add" href="/manage/content/pages/new" aria-current={pathname === "/manage/content/pages/new" ? "page" : undefined} onClick={() => {openGroup("pages"); onNavigate();}}><Plus size={16} aria-hidden="true" /><span className="ib-admin-side__label">Додати сторінку</span></Link>}
                        </>}
                    </div>
                </section>;
            })}
        </nav>
        <div className="ib-admin-side__foot"><Link className="ib-admin-side__item" href="/" onClick={onNavigate}><ArrowLeft size={16} aria-hidden="true" /><span className="ib-admin-side__label">На сайт події</span></Link></div>
    </aside>;
}
