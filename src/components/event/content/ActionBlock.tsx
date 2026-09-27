"use client";

import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getCurrentUser, getJoinStatus} from "@/api/clientAuth";

type Action = {label: string; kind?: "link" | "join_event"; href?: string};

function safeHref(href: string | undefined): string | undefined {
    if (!href || /[\\\r\n\t]/.test(href) || href.startsWith("//")) return undefined;
    if (href.startsWith("/") || href.startsWith("#")) return href;
    try { const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}

export function registrationWindowOpen(registrationOpen: boolean, joinPolicy: string, startAt: string, finishAt: string, now: number): boolean {
    if (!registrationOpen) return false;
    const start = Date.parse(startAt);
    const finish = Date.parse(finishAt);
    if (joinPolicy === "locked_at_start" && Number.isFinite(start) && now >= start) return false;
    if (Number.isFinite(finish) && now >= finish) return false;
    return true;
}

export function ActionBlock({id, title, text, variant, alignment, selected, preview, actions, registrationOpen, joinPolicy, startAt, finishAt, eventID, eventTag}: {
    id: string;
    title: string;
    text: string;
    variant?: string;
    alignment?: string;
    selected?: boolean;
    preview?: boolean;
    actions: Action[];
    registrationOpen: boolean;
    joinPolicy: string;
    startAt: string;
    finishAt: string;
    eventID: string;
    eventTag: string;
}) {
    const hasJoin = actions.some(action => action.kind === "join_event");
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!hasJoin || !registrationOpen) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [hasJoin, registrationOpen]);
    const windowOpen = registrationWindowOpen(registrationOpen, joinPolicy, startAt, finishAt, now);
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, enabled: hasJoin && !preview && windowOpen, retry: false, refetchInterval: false});
    const join = useQuery({queryKey: ["event-join-status", eventID], queryFn: getJoinStatus, enabled: hasJoin && !preview && windowOpen && !!eventID && !!identity.data, retry: false, refetchInterval: false});
    const canJoin = preview ? windowOpen : windowOpen && !identity.isPending && !identity.isError && (!identity.data || !join.isPending && !join.isError && join.data === 0);
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    const joinHref = preview || identity.data ? "/join" : domain && eventTag
        ? `https://id.${domain}/sign-in?return_to=${encodeURIComponent(`https://${eventTag}.${domain}/join`)}`
        : "/join";
    const visible = actions.flatMap((action, index) => {
        const href = action.kind === "join_event" ? canJoin ? joinHref : undefined : safeHref(action.href);
        return href && action.label ? [{href, label: action.label, index}] : [];
    });
    if (!visible.length && !title && !text) return null;
    const branded = variant === "mass";
    return <section className={`ib-block ib-block-cta${branded ? " ib-mass ib-mass-waves" : ""}${!title && !text ? " ib-block-cta--buttons-only" : ""} ib-block-cta--actions-${alignment ?? "end"}`} id={id} data-preview-selected={selected || undefined}>
        <div className="ib-block__in"><div>{title && <h2 className="ib-block-cta__title">{title}</h2>}{text && <p className="ib-block-cta__text">{text}</p>}</div>
            {visible.length > 0 && <div className="ib-block-cta__acts">{visible.map((action, position) => <a key={action.index} className={`ib-btn${position === 0 ? branded ? " ib-btn--mass" : " ib-btn--primary" : branded ? " ib-btn--mass-outline" : ""}`} href={action.href}>{action.label}</a>)}</div>}
        </div>
    </section>;
}
