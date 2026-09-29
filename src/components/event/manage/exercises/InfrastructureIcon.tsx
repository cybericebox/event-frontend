"use client";

import {Server} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

// The exercise has a lab: an icon, never a «type» label, explained by our
// tooltip. Inside another control it stays non-focusable (the control
// carries the name).
export function InfrastructureIcon({interactive = true}: {interactive?: boolean}) {
    const label = t("manage.exercises.infrastructureRequired");
    return <EventTooltip content={t("manage.challenges.set.infrastructureTip")}>{id => <span className="event-exercise-infra" role="img" tabIndex={interactive ? 0 : undefined} aria-label={label} aria-describedby={id}><Server aria-hidden="true" /></span>}</EventTooltip>;
}

// A badge with an explaining tooltip (version, source of a set).
export function TipTag({label, tip}: {label: string; tip: string}) {
    return <EventTooltip content={tip}>{id => <span className="ib-tag ib-tag--sm" tabIndex={0} aria-describedby={id}>{label}</span>}</EventTooltip>;
}
