"use client";

import {createContext, useContext, useEffect, type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {getManageAccess, ManageApiError} from "@/api/manage";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {GuestShell} from "./GuestShell";
import {EventLoading} from "./EventLoading";
import {EventBrandProvider} from "./EventBrandLogo";
import {idOrigin} from "@/utils/origins";

const PrivateEventContext = createContext<PublicEventInfo | null>(null);

export function usePrivateEvent(): PublicEventInfo | null {
    return useContext(PrivateEventContext);
}

export function PrivateEventBootstrap({children}: {children: ReactNode}) {
    const pathname = usePathname();
    const identity = useQuery({
        queryKey: ["event-manager-public-info"], queryFn: getClientEventInfo,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });
    const access = useQuery({
        queryKey: ["event-management-access", identity.data?.EventID],
        queryFn: () => getManageAccess(identity.data!.EventID),
        enabled: !!identity.data,
        retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!identity.data) return;
        const root = document.documentElement;
        root.style.setProperty("--ev-brand", identity.data.Theme.Brand);
        root.style.setProperty("--ev-accent-light", identity.data.Theme.AccentLight);
        root.style.setProperty("--ev-accent-dark", identity.data.Theme.AccentDark);
        root.style.setProperty("--ev-accent-live", identity.data.Theme.AccentLive);
        document.title = identity.data.Name;
    }, [identity.data]);

    if (identity.isPending || (identity.data && access.isPending)) {
        return <EventLoading event={identity.data} full label="Завантажуємо попередній перегляд події…" />;
    }
    if (identity.isError || access.isError) {
        const status = identity.error instanceof ClientEventInfoError ? identity.error.status
            : access.error instanceof ManageApiError ? access.error.status : 0;
        const unavailable = status === 0 || status >= 500;
        return <div className="event-shell-state" role="alert">
            <h1>{unavailable ? "Сервер події тимчасово недоступний" : "Подію не знайдено або доступ обмежено"}</h1>
            <p>{unavailable ? "Спробуйте повторити запит після відновлення з’єднання." : "До публікації перегляд доступний лише менеджерам цієї події."}</p>
            {unavailable
                ? <button className="ib-btn" onClick={() => void (identity.isError ? identity.refetch() : access.refetch())}>Повторити</button>
                : <a className="ib-btn ib-btn--primary" href={`${idOrigin}/sign-in?return_to=${encodeURIComponent(window.location.href)}`}>Увійти</a>}
        </div>;
    }
    const event = identity.data!;
    return <EventBrandProvider logoURL={event.LogoURL}><PrivateEventContext.Provider value={event}>
        <GuestShell event={event} authenticated>
            <div className="event-private-preview-banner" role="status">
                <span>Попередній перегляд. Сторінка ще недоступна відвідувачам.</span>
                <Link href={pathname === "/" ? "/manage/content/landing" : "/manage"}>{pathname === "/" ? "Редагувати головну" : "Керування подією"}</Link>
            </div>
            {children}
        </GuestShell>
    </PrivateEventContext.Provider></EventBrandProvider>;
}
