"use client";

import {useEffect, type ReactNode} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {ClientEventInfoError, getClientEventInfo} from "@/api/clientEventInfo";
import {getManageAccess, ManageApiError} from "@/api/manage";
import {LiveScreen} from "./LiveScreen";
import {idOrigin} from "@/utils/origins";
import "./live.css";

function signInHref(): string {
    return idOrigin ? `${idOrigin}/sign-in?return_to=${encodeURIComponent(window.location.href)}` : "/";
}

function State({title, text, action}: {title: string; text?: string; action?: ReactNode}) {
    return <main className="live-fullscreen"><div className="live-fullscreen__state" role="alert"><h1>{title}</h1>{text && <p>{text}</p>}{action}</div></main>;
}

// L1: the live screen is not public. A moderator opens it under their own
// account and puts it on the projector, so it checks management access first
// and reads everything through the browser session (works before publication).
export function LiveBootstrap() {
    const event = useQuery({queryKey: ["event-live-info"], queryFn: getClientEventInfo, retry: false, refetchOnWindowFocus: false});
    const access = useQuery({
        queryKey: ["event-management-access", event.data?.EventID], queryFn: () => getManageAccess(event.data!.EventID),
        enabled: !!event.data, retry: false, refetchOnWindowFocus: false,
    });
    useEffect(() => {
        if (!event.data) return;
        const root = document.documentElement;
        root.style.setProperty("--ev-brand", event.data.Theme.Brand);
        root.style.setProperty("--ev-accent-light", event.data.Theme.AccentLight);
        root.style.setProperty("--ev-accent-dark", event.data.Theme.AccentDark);
        root.style.setProperty("--ev-accent-live", event.data.Theme.AccentLive);
        document.title = `Live · ${event.data.Name}`;
    }, [event.data]);

    const failed = event.error ?? access.error;
    if (failed) {
        const status = failed instanceof ClientEventInfoError || failed instanceof ManageApiError ? failed.status : 0;
        if (status === 401 || (status === 404 && event.isError)) return <State title="Увійдіть, щоб відкрити Live-екран" text="Екран відкриває організатор або модератор події під своїм обліковим записом." action={<a className="ib-btn ib-btn--primary" href={signInHref()}>Увійти</a>} />;
        if (status === 403) return <State title="Немає доступу до Live-екрана" text="Live-екран доступний лише організаторам і модераторам цієї події." action={<Link className="ib-btn" href="/">На сайт події</Link>} />;
        return <State title="Не вдалося відкрити Live-екран" text="Повторіть запит, коли з’єднання відновиться." action={<button className="ib-btn" type="button" onClick={() => void (event.isError ? event.refetch() : access.refetch())}>Повторити</button>} />;
    }
    if (!event.data || !access.data) return <main className="live-fullscreen"><div className="live-fullscreen__state" role="status">Перевіряємо доступ…</div></main>;
    return <LiveScreen event={event.data} />;
}
