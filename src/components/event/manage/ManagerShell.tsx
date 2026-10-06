"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import {EventErrorScreen} from "@/components/event/EventErrorScreen";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {Menu} from "lucide-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {getCurrentUser} from "@/api/clientAuth";
import {getManageAccess, getManagePages, ManageApiError} from "@/api/manage";
import {EventLoading} from "../EventLoading";
import {EventHeaderActions} from "../EventNavigation";
import {OutageShell} from "../OutageShell";
import {NoAccessScreen} from "../NoAccessScreen";
import {SignInRedirect} from "../SignInRedirect";
import {useAnalyticsAccess} from "./analytics/useAnalyticsAccess";
import {SetupChip} from "./setup/SetupChip";
import {ManagerSidebar} from "./ManagerSidebar";
import {useDrawerContract} from "./useDrawerContract";
import {managerCrumbs} from "./managerNavigation";
import {isOutageError} from "@/utils/serviceStatus";
import {t} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {SkipLink} from "@/components/ui/SkipLink";

const ManagerContext = createContext<{event: PublicEventInfo; canManage: boolean} | null>(null);

export function useManager() {
    const context = useContext(ManagerContext);
    if (!context) throw new Error("Manager context is unavailable");
    return context;
}

export function ManagerShell({event, children, onSection}: {event: PublicEventInfo; children: ReactNode; onSection?: (title: string | null) => void}) {
    const pathname = usePathname();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);
    const menuRef = useRef<HTMLButtonElement>(null);
    const mainRef = useRef<HTMLDivElement>(null);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    useDrawerContract({open: drawerOpen, onClose: closeDrawer, drawer: sidebarRef, opener: menuRef, behind: mainRef});
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

    // Platform staff always get the way back to the platform panel; others only through a validated `?from=`.
    const profile = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false});
    const platformStaff = !!profile.data && profile.data.Role !== "user";

    const analytics = useAnalyticsAccess(event.EventID, !!access.data);
    const crumbs = access.data ? managerCrumbs(pathname, pages.data ?? []) : null;
    const section = crumbs ? crumbs[crumbs.length - 1].label : null;
    useEffect(() => {
        onSection?.(section);
        return () => onSection?.(null);
    }, [section, onSection]);

    if (access.isPending) return <EventLoading event={event} full label={t("manage.shell.checkingAccess")} />;
    if (access.isError) {
        const status = access.error instanceof ManageApiError ? access.error.status : 0;
        // An outage keeps the frame under the outage modal; access refetches on recovery.
        if (isOutageError(access.error, status)) return <OutageShell manage event={event} />;
        // 401: no session, straight to the sign-in and back here (no screen in between). 403: signed in without rights.
        if (status === 401) return <SignInRedirect event={event} />;
        if (status === 403) return <NoAccessScreen title={t("manage.shell.forbiddenTitle")} homeHref="/" />;
        return <EventErrorScreen title={t("manage.shell.loadFailedTitle")} body={t("manage.shell.loadFailedBody")} error={access.error} onRetry={() => void access.refetch()} page />;
    }

    return <div className="event-manage-frame">
        <div className={`ib-admin-shell event-manage-shell${drawerOpen ? " is-drawer-open" : ""}`}>
        <SkipLink />
        <div className="ib-admin-shell__layout">
            <ManagerSidebar asideRef={sidebarRef} drawerOpen={drawerOpen} event={event} pathname={pathname} pages={pages.data} pagesError={pages.isError} canManage={access.data.CanManage} platformStaff={platformStaff} infrastructureAllowed={access.data.InfrastructureAllowed} analytics={analytics.data} onRetryPages={() => void pages.refetch()} onNavigate={closeDrawer} />
            <div ref={mainRef} className="ib-admin-shell__main">
                <header className="ib-topbar">
                    <EventTooltip content={t("manage.shell.openMenu")} silent>{() => <button ref={menuRef} className="ib-topbar__icon-btn ib-topbar__menu" type="button" aria-label={t("manage.shell.openMenu")} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>}</EventTooltip>
                    <ol className="ib-topbar__crumbs">{(crumbs ?? [{label: t("manage.nav.eventManagement")}]).map((crumb, index, all) => index === all.length - 1
                        ? <li key={index} aria-current="page">{crumb.label}</li>
                        : <li key={index}>{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}</li>)}</ol>
                    <div className="ib-topbar__actions"><SetupChip eventID={event.EventID} />{!access.data.CanManage && <span className="event-manage-mode">{t("manage.shell.readOnly")}</span>}<EventHeaderActions event={event} authenticated /></div>
                </header>
                <main id="main" tabIndex={-1} className="ib-admin-shell__scroll"><ManagerContext.Provider value={{event, canManage: access.data.CanManage}}>{children}</ManagerContext.Provider></main>
            </div>
        </div>
        <button className="ib-admin-shell__backdrop" type="button" aria-label={t("manage.shell.closeMenu")} onClick={closeDrawer} />
        </div>
    </div>;
}
