import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventBrandLogo} from "./EventBrandLogo";

export function EventLoading({event, label = "Завантаження…", full = false}: {
    event?: PublicEventInfo | null;
    label?: string;
    full?: boolean;
}) {
    return <div className={full ? "event-shell-state" : "event-content-loading"} role="status" aria-label={label}>
        <EventBrandLogo event={event} className="event-loading-logo" size={64} />
        <span className="event-loading-label">{label}</span>
    </div>;
}
