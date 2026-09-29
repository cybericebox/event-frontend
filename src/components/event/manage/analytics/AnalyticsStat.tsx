"use client";

import {CircleHelp} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import "./analytics.css";

// One number of a counter grid: label, value, an optional note under it, and
// the hint (?) that explains what is counted.
export function AnalyticsStat({label, value, note, hint}: {label: string; value: string; note?: string; hint: string}) {
    return <div className="event-analytics-stat">
        <div className="event-analytics-stat__label">
            <span>{label}</span>
            <EventTooltip content={hint}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: label})} aria-describedby={id}><CircleHelp size={14} /></button>}</EventTooltip>
        </div>
        <strong className="event-analytics-stat__value">{value}</strong>
        {note && <small className="event-analytics-stat__note">{note}</small>}
    </div>;
}

export function AnalyticsStatGrid({label, children}: {label: string; children: React.ReactNode}) {
    return <section className="event-analytics-stats" aria-label={label}>{children}</section>;
}
