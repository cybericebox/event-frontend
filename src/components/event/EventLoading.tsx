import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventBrandLogo} from "./EventBrandLogo";
import {t} from "@/i18n/t";

export function EventLoading({event, label, message, full = false}: {
    event?: PublicEventInfo | null;
    label?: string;
    message?: string;
    full?: boolean;
}) {
    return <div className={full ? "event-shell-state" : "event-content-loading"} role="status" aria-label={label ?? message ?? t("common.loading")}>
        {event && <EventBrandLogo event={event} className="event-loading-logo" size={64} />}
        {(message || !event && label) && <span className="event-loading-label" aria-hidden="true">{message ?? label}</span>}
    </div>;
}
