"use client";

import {Server} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

// The exercise has a lab: an icon, never a «type» label. Inside another
// control it stays non-focusable and falls back to a native title.
export function InfrastructureIcon({interactive = true}: {interactive?: boolean}) {
    const label = t("manage.exercises.infrastructureRequired");
    if (!interactive) return <span className="event-exercise-infra" role="img" aria-label={label} title={label}><Server aria-hidden="true" /></span>;
    return <EventTooltip content={label}>{id => <span className="event-exercise-infra" role="img" tabIndex={0} aria-label={label} aria-describedby={id}><Server aria-hidden="true" /></span>}</EventTooltip>;
}
