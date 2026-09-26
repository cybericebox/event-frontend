"use client";

import {createContext, useContext, useState, type ReactNode} from "react";
import Image from "next/image";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {ArrowLeft, CalendarDays, ExternalLink, FileText, LayoutDashboard, Menu, Settings2, X} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {getManageAccess, ManageApiError} from "@/api/manage";
import crest from "@/styles/assets/crest-128.png";
import {EventNavbar} from "../EventNavbar";

function signInHref(event: PublicEventInfo): string {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) return "/";
    return `https://id.${domain}/sign-in?return_to=${encodeURIComponent(`https://${event.Tag}.${domain}/manage`)}`;
}

const ManagerContext = createContext<{event: PublicEventInfo; canManage: boolean} | null>(null);

export function useManager() {
    const context = useContext(ManagerContext);
    if (!context) throw new Error("Manager context is unavailable");
    return context;
}

export function ManagerShell({event, children}: {event: PublicEventInfo; children: ReactNode}) {
    const pathname = usePathname();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const access = useQuery({
        queryKey: ["event-management-access", event.EventID],
        queryFn: () => getManageAccess(event.EventID),
        retry: false,
        refetchInterval: false,
        refetchOnWindowFocus: false,
    });

    if (access.isPending) return <div className="event-shell-state" role="status">Перевіряємо доступ до керування подією…</div>;
    if (access.isError) {
        const status = access.error instanceof ManageApiError ? access.error.status : 0;
        return <div className="event-shell-state" role="alert">
            <h1>{status === 403 ? "Немає доступу до керування" : status === 401 ? "Потрібно увійти" : "Не вдалося завантажити керування"}</h1>
            <p>{status === 403 ? "Ваш обліковий запис не призначено для керування цією подією." : status === 401 ? "Увійдіть в обліковий запис менеджера події." : "Дані події залишилися без змін. Повторіть запит, коли з’єднання відновиться."}</p>
            {status === 401 ? <a className="ib-btn ib-btn--primary" href={signInHref(event)}>Увійти</a> : status === 403 ? <Link className="ib-btn" href="/">На сайт події</Link> : <button className="ib-btn" onClick={() => void access.refetch()}>Повторити</button>}
        </div>;
    }

    return <div className="event-manage-frame">
        <EventNavbar event={event} authenticated management />
        <div className={`ib-admin-shell event-manage-shell${drawerOpen ? " is-drawer-open" : ""}`}>
        <div className="ib-admin-shell__layout">
            <aside className="ib-admin-side ib-mass" aria-label="Керування подією">
                <div className="ib-admin-side__head">
                    <Image className="ib-admin-side__crest" src={crest} alt="" width={32} height={32} />
                    <div className="ib-admin-side__title"><b>{event.Name}</b><small>Керування подією</small></div>
                    <button className="ib-admin-side__close" type="button" aria-label="Закрити меню" onClick={() => setDrawerOpen(false)}><X size={18} /></button>
                </div>
                <nav className="ib-admin-side__nav" aria-label="Розділи керування">
                    <div className="ib-admin-side__group">Подія</div>
                    <Link className="ib-admin-side__item" href="/manage" aria-current={pathname === "/manage" ? "page" : undefined} onClick={() => setDrawerOpen(false)}><LayoutDashboard size={16} /><span className="ib-admin-side__label">Огляд і підготовка</span></Link>
                    <Link className="ib-admin-side__item" href="/manage/settings" aria-current={pathname === "/manage/settings" ? "page" : undefined} onClick={() => setDrawerOpen(false)}><Settings2 size={16} /><span className="ib-admin-side__label">Налаштування</span></Link>
                    <Link className="ib-admin-side__item" href="/manage/schedule" aria-current={pathname === "/manage/schedule" ? "page" : undefined} onClick={() => setDrawerOpen(false)}><CalendarDays size={16} /><span className="ib-admin-side__label">Розклад</span></Link>
                    <Link className="ib-admin-side__item" href="/manage/content/landing" aria-current={pathname === "/manage/content/landing" ? "page" : undefined} onClick={() => setDrawerOpen(false)}><FileText size={16} /><span className="ib-admin-side__label">Головна сторінка</span></Link>
                </nav>
                <div className="ib-admin-side__foot"><Link className="ib-admin-side__item" href="/" onClick={() => setDrawerOpen(false)}><ArrowLeft size={16} /><span className="ib-admin-side__label">На сайт події</span></Link></div>
            </aside>
            <div className="ib-admin-shell__main">
                <header className="ib-topbar">
                    <button className="ib-topbar__icon-btn ib-topbar__menu" type="button" aria-label="Відкрити меню" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>
                    <ol className="ib-topbar__crumbs"><li><Link href="/manage">Керування</Link></li><li aria-current="page">{pathname === "/manage" ? "Огляд і підготовка" : pathname === "/manage/schedule" ? "Розклад" : pathname === "/manage/content/landing" ? "Головна сторінка" : "Налаштування"}</li></ol>
                    <div className="ib-topbar__actions"><span className="event-manage-mode">{access.data.CanManage ? "Редагування" : "Лише перегляд"}</span><Link className="ib-topbar__icon-btn" href="/" aria-label="Відкрити сайт події"><ExternalLink size={18} /></Link></div>
                </header>
                <main className="ib-admin-shell__scroll"><ManagerContext.Provider value={{event, canManage: access.data.CanManage}}>{children}</ManagerContext.Provider></main>
            </div>
        </div>
        <button className="ib-admin-shell__backdrop" type="button" aria-label="Закрити меню" onClick={() => setDrawerOpen(false)} />
        </div>
    </div>;
}
