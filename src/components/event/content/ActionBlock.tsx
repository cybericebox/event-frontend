"use client";

import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getCurrentUser, getInvitationInfo, getJoinStatus} from "@/api/clientAuth";
import {eventOrigin, idOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";

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

export type PreviewViewer = "guest" | "participant" | "moderator";

// What the join action shows for this visitor. «loading» keeps the button's
// space so the page does not jump when the status arrives (B5).
export type JoinState =
    | {kind: "loading"}
    | {kind: "hidden"}
    | {kind: "join"; href: string}
    | {kind: "invite"}
    | {kind: "pending"}
    | {kind: "approved"}
    | {kind: "rejected"};

export function joinState({preview, windowOpen, timeWindowOpen, identity, status, invitation, signInHref}: {
    preview?: PreviewViewer;
    windowOpen: boolean;
    timeWindowOpen: boolean;
    identity: "loading" | "guest" | "user";
    status?: number | "loading" | "error";
    invitation?: {Invited?: boolean; InvitationExpired?: boolean} | "loading";
    signInHref: string;
}): JoinState {
    if (preview === "participant") return {kind: "approved"};
    if (preview) return windowOpen ? {kind: "join", href: "/join"} : {kind: "hidden"};
    if (identity === "loading") return {kind: "loading"};
    if (identity === "guest") return windowOpen ? {kind: "join", href: signInHref} : {kind: "hidden"};
    if (status === "loading" || status === undefined) return {kind: "loading"};
    if (status === "error") return {kind: "hidden"};
    switch (status) {
        case 0: return windowOpen ? {kind: "join", href: "/join"} : {kind: "hidden"};
        case 1:
            if (invitation === "loading" || invitation === undefined) return {kind: "loading"};
            // Invitations ignore the registration type but not the registration window.
            if (invitation.Invited) return timeWindowOpen && !invitation.InvitationExpired ? {kind: "invite"} : {kind: "hidden"};
            return {kind: "pending"};
        case 2: return {kind: "approved"};
        case 3: return {kind: "rejected"};
        default: return {kind: "hidden"};
    }
}

const joinLabel = (kind: "invite" | "pending" | "approved" | "rejected") => t(`content.join.${kind}`);

export function ActionBlock({id, title, text, variant, alignment, selected, primaryHeading, preview, previewViewer, actions, registrationOpen, joinPolicy, startAt, finishAt, eventID, eventTag}: {
    id: string;
    title: string;
    text: string;
    variant?: string;
    alignment?: string;
    selected?: boolean;
    primaryHeading?: boolean;
    preview?: boolean;
    previewViewer?: PreviewViewer;
    actions: Action[];
    registrationOpen: boolean;
    joinPolicy: string;
    startAt: string;
    finishAt: string;
    eventID: string;
    eventTag: string;
}) {
    const hasJoin = actions.some(action => action.kind === "join_event");
    const viewer = preview ? previewViewer ?? "guest" : undefined;
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!hasJoin || !registrationOpen) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [hasJoin, registrationOpen]);
    const timeWindowOpen = registrationWindowOpen(true, joinPolicy, startAt, finishAt, now);
    const windowOpen = registrationOpen && timeWindowOpen;
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, enabled: hasJoin && !viewer, retry: false, refetchInterval: false});
    const join = useQuery({queryKey: ["event-join-status", eventID], queryFn: getJoinStatus, enabled: hasJoin && !viewer && !!eventID && !!identity.data, retry: false, refetchInterval: false});
    const invitation = useQuery({queryKey: ["event-invitation-status", eventID], queryFn: () => getInvitationInfo(), enabled: hasJoin && !viewer && join.data === 1, retry: false, refetchInterval: false});
    const eventSite = eventTag ? eventOrigin(eventTag) : "";
    const signInHref = idOrigin && eventSite
        ? `${idOrigin}/sign-in?return_to=${encodeURIComponent(`${eventSite}/join`)}`
        : "/join";
    const state = hasJoin ? joinState({
        preview: viewer, windowOpen, timeWindowOpen, signInHref,
        identity: identity.isPending ? "loading" : identity.data ? "user" : "guest",
        status: join.isPending ? "loading" : join.isError ? "error" : join.data,
        invitation: invitation.isPending ? "loading" : invitation.data,
    }) : {kind: "hidden" as const};
    const visible = actions.flatMap((action, index): {index: number; label: string; href?: string; status?: "loading" | "static"}[] => {
        if (action.kind !== "join_event") {
            const href = safeHref(action.href);
            return href && action.label ? [{href, label: action.label, index}] : [];
        }
        switch (state.kind) {
            case "hidden": return [];
            case "loading": return action.label ? [{label: action.label, index, status: "loading"}] : [];
            case "join": return action.label ? [{href: state.href, label: action.label, index}] : [];
            case "invite": return [{href: "/invite", label: joinLabel("invite"), index}];
            case "approved": return [{href: "/challenges", label: joinLabel("approved"), index}];
            case "pending": case "rejected": return [{label: joinLabel(state.kind), index, status: "static"}];
        }
    });
    if (!visible.length && !title && !text) return null;
    const branded = variant === "mass";
    return <section className={`ib-block ib-block-cta${branded ? " ib-mass ib-mass-waves" : ""}${!title && !text ? " ib-block-cta--buttons-only" : ""} ib-block-cta--actions-${alignment ?? "end"}`} id={id} data-preview-selected={selected || undefined}>
        <div className="ib-block__in"><div>{title && (primaryHeading ? <h1 className="ib-block-cta__title">{title}</h1> : <h2 className="ib-block-cta__title">{title}</h2>)}{text && <p className="ib-block-cta__text">{text}</p>}</div>
            {visible.length > 0 && <div className="ib-block-cta__acts">{visible.map((action, position) => {
                const className = `ib-btn${position === 0 ? branded ? " ib-btn--mass" : " ib-btn--primary" : branded ? " ib-btn--mass-outline" : ""}`;
                if (action.status === "loading") return <span key={action.index} className={`${className} ib-block-cta__reserved`} aria-hidden="true">{action.label}</span>;
                if (action.status === "static") return <span key={action.index} className={`${className} ib-block-cta__status`} role="status">{action.label}</span>;
                return <a key={action.index} className={className} href={action.href}>{action.label}</a>;
            })}</div>}
        </div>
    </section>;
}
