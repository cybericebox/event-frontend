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
import {NoAccessScreen} from "../NoAccessScreen";
import {SignInRedirect} from "../SignInRedirect";
import {useAnalyticsAccess} from "./analytics/useAnalyticsAccess";
import {SetupChip} from "./setup/SetupChip";
import {ManagerSidebar} from "./ManagerSidebar";
import {managerLocationTitle} from "./managerNavigation";
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

    const analytics = useAnalyticsAccess(event.EventID, !!access.data);

    if (access.isPending) return <EventLoading event={event} full label={t("manage.shell.checkingAccess")} />;
    if (access.isError) {
        const status = access.error instanceof ManageApiError ? access.error.status : 0;
        // An outage keeps the frame under the outage modal; access refetches on recovery.
        if (isOutageError(access.error, status)) return <OutageShell manage event={event} />;
        // 401: no session, straight to the sign-in and back here (no screen in between). 403: signed in without rights.
        if (status === 401) return <SignInRedirect event={event} />;
        if (status === 403) return <NoAccessScreen title={t("manage.shell.forbiddenTitle")} homeHref="/" />;
        return <EventErrorScreen title={t("manage.shell.loadFailedTitle")} body={t("manage.shell.loadFailedBody")} onRetry={() => void access.refetch()} page />;
    }

    return <div className="event-manage-frame">
        <div className={`ib-admin-shell event-manage-shell${drawerOpen ? " is-drawer-open" : ""}`}>
        <SkipLink />
        <div className="ib-admin-shell__layout">
            <ManagerSidebar event={event} pathname={pathname} pages={pages.data} pagesError={pages.isError} canManage={access.data.CanManage} infrastructureAllowed={access.data.InfrastructureAllowed} analytics={analytics.data} onRetryPages={() => void pages.refetch()} onNavigate={() => setDrawerOpen(false)} />
            <div className="ib-admin-shell__main">
                <header className="ib-topbar">
                    <EventTooltip content={t("manage.shell.openMenu")} silent>{() => <button className="ib-topbar__icon-btn ib-topbar__menu" type="button" aria-label={t("manage.shell.openMenu")} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>}</EventTooltip>
                    <ol className="ib-topbar__crumbs"><li aria-current="page">{managerLocationTitle(pathname, pages.data ?? [])}</li></ol>
                    <div className="ib-topbar__actions"><SetupChip eventID={event.EventID} />{!access.data.CanManage && <span className="event-manage-mode">{t("manage.shell.readOnly")}</span>}<EventHeaderActions event={event} authenticated /></div>
                </header>
                <main id="main" tabIndex={-1} className="ib-admin-shell__scroll"><ManagerContext.Provider value={{event, canManage: access.data.CanManage}}>{children}</ManagerContext.Provider></main>
            </div>
        </div>
        <button className="ib-admin-shell__backdrop" type="button" aria-label={t("manage.shell.closeMenu")} onClick={() => setDrawerOpen(false)} />
        </div>
    </div>;
}
