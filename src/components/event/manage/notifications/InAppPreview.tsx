"use client";

import DOMPurify from "isomorphic-dompurify";
import type {ManageInAppTemplateInput} from "@/api/manageNotifications";
import {NotificationMessageCard} from "@/components/event/NotificationMessageCard";
import {popInDuration} from "@/components/event/NotificationPopIn";
import {t} from "@/i18n/t";
import {fillSamples} from "./notificationModel";

function safeHref(value: string): boolean {
    const href = value.trim();
    return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#") || /^https?:\/\/|^mailto:/i.test(href);
}

// A read-only preview of an in-app notification, drawn like the real ones: the
// row of the inbox list (text only, like the list shows it) and the pop-in
// banner (with its formatting and button), with the sample variable values.
export function InAppPreview({template, values}: {template: ManageInAppTemplateInput; values: Record<string, string>}) {
    const title = fillSamples(template.Title, values);
    const body = fillSamples(template.Body, values, true);
    const link = fillSamples(template.Link, values);
    const action = template.Actions.find(item => item.label && safeHref(item.href));
    const inboxAction = safeHref(link) && link.trim() ? t("inbox.open") : null;
    const seconds = popInDuration(template.AutoDismissMs) / 1000;
    return <div className="event-manage-notifications__stage">
        <div className="event-manage-notifications__stage-item">
            <h3>{t("manage.notifications.previewInbox")}</h3>
            <ul className="event-notifications__list event-manage-notifications__inbox">
                <li><NotificationMessageCard icon={template.Icon} tone={template.Tone} accentColor={template.AccentColor} title={title} unread compact
                    body={body ? <span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(body, {ALLOWED_TAGS: [], ALLOWED_ATTR: []})}} /> : undefined}
                    timestamp={<span className="event-notifications__meta">{t("manage.notifications.previewJustNow")}</span>}
                    actions={inboxAction ? <button type="button" tabIndex={-1}>{inboxAction}</button> : undefined} /></li>
            </ul>
        </div>
        <div className="event-manage-notifications__stage-item">
            <h3>{t("manage.notifications.previewPopIn")}</h3>
            <div className="event-notification-popin">
                <div className="event-notification-popin__content"><NotificationMessageCard icon={template.Icon} tone={template.Tone} accentColor={template.AccentColor} title={title}
                    body={body ? <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(body)}} /> : undefined}
                    actions={action ? <button type="button" tabIndex={-1}>{action.label}</button> : undefined} /></div>
            </div>
            <small>{t("manage.notifications.previewPopInTime", {seconds})}</small>
        </div>
    </div>;
}
