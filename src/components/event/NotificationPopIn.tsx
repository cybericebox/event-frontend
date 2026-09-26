"use client";

import {useEffect, useRef, useState} from "react";
import DOMPurify from "isomorphic-dompurify";
import {AlertTriangle, Bell, CalendarDays, CheckCircle2, CircleHelp, Info, Mail, ShieldCheck, Trophy, UserRound, X, XCircle, type LucideIcon} from "lucide-react";
import type {InboxItem} from "@/api/inbox";

export function popInDuration(value: number | null | undefined): number {
    return value == null ? 5000 : Math.min(10000, Math.max(3000, value));
}

const icons: Record<string, LucideIcon> = {
    info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle,
    bell: Bell, mail: Mail, calendar: CalendarDays, user: UserRound,
    shield: ShieldCheck, trophy: Trophy, help: CircleHelp,
};
const tones: Record<string, string> = {
    neutral: "#64748B", info: "#0091EA", success: "#16A34A",
    warning: "#D97706", danger: "#DC2626",
};

function safeHref(value: string): boolean {
    const href = value.trim();
    return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#") || /^https?:\/\/|^mailto:/i.test(href);
}

export function NotificationPopIn({message, onClose, onAction}: {
    message: InboxItem; onClose: () => void; onAction: (href: string) => void;
}) {
    const duration = popInDuration(message.AutoDismissMs);
    const [paused, setPaused] = useState(false);
    const remaining = useRef(duration);
    const close = useRef(onClose);
    useEffect(() => { close.current = onClose; }, [onClose]);
    useEffect(() => {
        if (paused) return;
        const started = Date.now();
        const timer = window.setTimeout(() => close.current(), remaining.current);
        return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)); };
    }, [paused, message.ID]);
    const accent = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(message.AccentColor ?? "")
        ? message.AccentColor! : tones[message.Tone ?? "neutral"] ?? tones.neutral;
    const Icon = icons[message.Icon ?? "bell"] ?? Bell;
    const action = message.Actions?.find(item => item.label && safeHref(item.href));

    return <div className="event-notification-popin" role="status" aria-label="Нове повідомлення"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)} onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);}}>
        <button className="event-notification-popin__close" type="button" onClick={onClose} aria-label="Закрити повідомлення"><X size={16} /></button>
        <Icon size={18} aria-hidden="true" style={{color: accent}} />
        <div><strong>{message.Title}</strong>{message.Body && <p dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(message.Body)}} />}
            {action && <button type="button" onClick={() => onAction(action.href)}>{action.label}</button>}
        </div>
        <span className="event-notification-popin__track" aria-hidden="true"><span style={{backgroundColor: accent, animationDuration: duration + "ms", animationPlayState: paused ? "paused" : "running"}} /></span>
    </div>;
}
