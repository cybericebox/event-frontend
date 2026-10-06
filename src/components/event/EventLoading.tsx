import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventBrandLogo} from "./EventBrandLogo";
import {t} from "@/i18n/t";

// The only loading indicator: the event logo (crest fallback), centered in its
// block, plus an optional line for a specific loading stage. `label` is read by
// screen readers only. The block keeps the EmptyState size, so loading → empty
// never jumps.
export function EventLoading({event, label, message, full = false, compact = false}: {
    event?: PublicEventInfo | null;
    label?: string;
    message?: string;
    full?: boolean;
    compact?: boolean;
}) {
    const className = full ? "event-shell-state" : "event-block-state" + (compact ? " event-block-state--compact" : "");
    return <div className={className} role="status" aria-label={label ?? message ?? t("common.loading")}>
        <EventBrandLogo event={event} className="event-loading-logo" size={compact ? 40 : 64} />
        {message && <span className="event-loading-label" aria-hidden="true">{message}</span>}
    </div>;
}
