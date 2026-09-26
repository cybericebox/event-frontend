import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventBrandLogo} from "./EventBrandLogo";

export function EventLoading({event, label, message, full = false}: {
    event?: PublicEventInfo | null;
    label?: string;
    message?: string;
    full?: boolean;
}) {
    return <div className={full ? "event-shell-state" : "event-content-loading"} role="status" aria-label={label ?? message ?? "Завантаження"}>
        <EventBrandLogo event={event} className="event-loading-logo" size={64} />
        {message && <span className="event-loading-label" aria-hidden="true">{message}</span>}
    </div>;
}
