"use client";

import {useEffect, useRef, useState} from "react";
import DOMPurify from "isomorphic-dompurify";
import {X} from "lucide-react";
import type {InboxMessage} from "./inboxModel";
import {NotificationMessageCard} from "./NotificationMessageCard";
import {notificationAccent} from "./NotificationIcon";
import {t} from "@/i18n/t";
import { keepBrand } from "@/i18n/brand";

export function popInDuration(value: number | null | undefined): number {
    return value == null ? 5000 : Math.min(10000, Math.max(3000, value));
}

function safeHref(value: string): boolean {
    const href = value.trim();
    return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#") || /^https?:\/\/|^mailto:/i.test(href);
}

export function NotificationPopIn({message, onClose, onAction}: {
    message: InboxMessage; onClose: () => void; onAction: (href: string) => void;
}) {
    const action = message.Actions?.find(item => item.label && safeHref(item.href));
    // A pop-in with an action stays until it is used or closed: the reader needs time to decide.
    const duration = action ? 0 : popInDuration(message.AutoDismissMs);
    const [paused, setPaused] = useState(false);
    const remaining = useRef(duration);
    const close = useRef(onClose);
    useEffect(() => { close.current = onClose; }, [onClose]);
    useEffect(() => { remaining.current = duration; }, [duration, message.ID]);
    useEffect(() => {
        if (duration <= 0 || paused) return;
        const started = Date.now();
        const timer = window.setTimeout(() => close.current(), remaining.current);
        return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)); };
    }, [duration, paused, message.ID]);
    const accent = notificationAccent(message.Tone, message.AccentColor);

    return <div className="event-notification-popin" onTouchStart={() => setPaused(true)}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)} onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);}}>
        <button className="event-notification-popin__close" type="button" onClick={onClose} aria-label={t("notifications.close")}><X size={16} /></button>
        <div className="event-notification-popin__content"><NotificationMessageCard
            icon={message.Icon} tone={message.Tone} accentColor={message.AccentColor} title={message.Title}
            body={message.Body && <div dangerouslySetInnerHTML={{__html: keepBrand(DOMPurify.sanitize(message.Body, {ALLOWED_TAGS: [], ALLOWED_ATTR: []}))}} />}
            actions={action && <button type="button" onClick={() => onAction(action.href)}>{action.label}</button>}
        />
        </div>
        {duration > 0 && <span className="event-notification-popin__track" aria-hidden="true"><span style={{backgroundColor: accent, animationDuration: duration + "ms", animationPlayState: paused ? "paused" : "running"}} /></span>}
    </div>;
}
