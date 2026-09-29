"use client";

import {createContext, useContext, useState, type ReactNode} from "react";
import {EventErrorScreen} from "@/components/event/EventErrorScreen";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {Menu} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {getManageAccess, getManagePages, ManageApiError} from "@/api/manage";
import {EventLoading} from "../EventLoading";
import {EventHeaderActions} from "../EventNavigation";
import {OutageShell} from "../OutageShell";
import {ManagerSidebar} from "./ManagerSidebar";
import {managerLocationTitle} from "./managerNavigation";
import Link from "next/link";
import {eventOrigin, idOrigin} from "@/utils/origins";
import {isOutageError} from "@/utils/serviceStatus";
import {t} from "@/i18n/t";

function signInHref(event: PublicEventInfo): string {
    const back = eventOrigin(event.Tag);
    if (!idOrigin || !back) return "/";
    return `${idOrigin}/sign-in?return_to=${encodeURIComponent(`${back}/manage`)}`;
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
    const pages = useQuery({
        queryKey: ["event-management-pages", event.EventID],
        queryFn: () => getManagePages(event.EventID),
        enabled: !!access.data,
        retry: false, refetchOnWindowFocus: false,
    });

    if (access.isPending) return <EventLoading event={event} full label={t("manage.shell.checkingAccess")} />;
    if (access.isError) {
        const status = access.error instanceof ManageApiError ? access.error.status : 0;
        // An outage keeps the frame under the outage modal; access refetches on recovery.
        if (isOutageError(access.error, status)) return <OutageShell manage event={event} />;
        if (status !== 401 && status !== 403) return <EventErrorScreen title={t("manage.shell.loadFailedTitle")} body={t("manage.shell.loadFailedBody")} onRetry={() => void access.refetch()} page />;
        return <div className="event-shell-state" role="alert">
            <h1>{status === 403 ? t("manage.shell.forbiddenTitle") : t("manage.shell.signInTitle")}</h1>
            <p>{status === 403 ? t("manage.shell.forbiddenBody") : t("manage.shell.signInBody")}</p>
            {status === 401 ? <a className="ib-btn ib-btn--primary" href={signInHref(event)}>{t("common.signIn")}</a> : <Link className="ib-btn" href="/">{t("manage.shell.toEventSite")}</Link>}
        </div>;
    }

    return <div className="event-manage-frame">
        <div className={`ib-admin-shell event-manage-shell${drawerOpen ? " is-drawer-open" : ""}`}>
        <div className="ib-admin-shell__layout">
            <ManagerSidebar event={event} pathname={pathname} pages={pages.data} pagesError={pages.isError} canManage={access.data.CanManage} infrastructureAllowed={access.data.InfrastructureAllowed} onRetryPages={() => void pages.refetch()} onNavigate={() => setDrawerOpen(false)} />
            <div className="ib-admin-shell__main">
                <header className="ib-topbar">
                    <button className="ib-topbar__icon-btn ib-topbar__menu" type="button" aria-label={t("manage.shell.openMenu")} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>
                    <ol className="ib-topbar__crumbs"><li aria-current="page">{managerLocationTitle(pathname, pages.data ?? [])}</li></ol>
                    <div className="ib-topbar__actions">{!access.data.CanManage && <span className="event-manage-mode">{t("manage.shell.readOnly")}</span>}<EventHeaderActions event={event} authenticated /></div>
                </header>
                <main className="ib-admin-shell__scroll"><ManagerContext.Provider value={{event, canManage: access.data.CanManage}}>{children}</ManagerContext.Provider></main>
            </div>
        </div>
        <button className="ib-admin-shell__backdrop" type="button" aria-label={t("manage.shell.closeMenu")} onClick={() => setDrawerOpen(false)} />
        </div>
    </div>;
}
