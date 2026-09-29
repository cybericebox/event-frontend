"use client";

import {useEffect, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {ManagerShell} from "./ManagerShell";
import {EventLoading} from "../EventLoading";
import {EventBrandProvider} from "../EventBrandLogo";
import {idOrigin} from "@/utils/origins";

export function ManagerBootstrap({children}: {children: ReactNode}) {
    const event = useQuery({
        queryKey: ["event-manager-public-info"],
        queryFn: getClientEventInfo,
        retry: false,
        refetchInterval: false,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!event.data) return;
        const root = document.documentElement;
        root.style.setProperty("--ev-brand", event.data.Theme.Brand);
        root.style.setProperty("--ev-accent-light", event.data.Theme.AccentLight);
        root.style.setProperty("--ev-accent-dark", event.data.Theme.AccentDark);
        root.style.setProperty("--ev-accent-live", event.data.Theme.AccentLive);
        document.title = `${event.data.Name} | Cyber ICE Box`;
    }, [event.data]);

    if (event.isPending) return <EventLoading full label="Завантажуємо керування подією…" />;
    if (event.isError) {
        const status = event.error instanceof ClientEventInfoError ? event.error.status : 0;
        const unavailable = status === 0 || status >= 500;
        return <div className="event-shell-state" role="alert">
            <h1>{unavailable ? "Сервер події тимчасово недоступний" : "Подію не знайдено або доступ обмежено"}</h1>
            <p>{unavailable ? "Спробуйте повторити запит, коли з’єднання відновиться." : "Увійдіть в обліковий запис менеджера цієї події."}</p>
            {unavailable
                ? <button className="ib-btn" onClick={() => void event.refetch()}>Повторити</button>
                : <a className="ib-btn ib-btn--primary" href={`${idOrigin}/sign-in?return_to=${encodeURIComponent(window.location.href)}`}>Увійти</a>}
        </div>;
    }
    return <EventBrandProvider logoURL={event.data.LogoURL}><ManagerShell event={event.data}>{children}</ManagerShell></EventBrandProvider>;
}
