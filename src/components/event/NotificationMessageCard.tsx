import type {ReactNode} from "react";
import {NotificationIcon} from "./NotificationIcon";
import {t} from "@/i18n/t";
import { keepBrand } from "@/i18n/brand";

export function NotificationMessageCard({icon, tone, accentColor, title, body, timestamp, unread = false, actions, compact = false}: {
    icon?: string; tone?: string; accentColor?: string; title?: string; body?: ReactNode;
    timestamp?: ReactNode; unread?: boolean; actions?: ReactNode; compact?: boolean;
}) {
    return <div className={`event-notification-card${compact ? " is-compact" : ""}`}>
        <NotificationIcon icon={icon} tone={tone} accentColor={accentColor} compact={compact} />
        <div className="event-notification-card__content">
            {title && <div className="event-notification-card__heading"><p className={unread ? "is-unread" : ""}>{keepBrand(title)}</p>{unread && <span className="ib-sr">{t("notifications.unread")}</span>}</div>}
            {body && <div className="event-notification-card__body">{body}</div>}
            {timestamp && <div className="event-notification-card__time">{timestamp}</div>}
            {actions && <div className="event-notification-card__actions">{actions}</div>}
        </div>
    </div>;
}
