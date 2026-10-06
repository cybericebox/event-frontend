"use client";

import {AlertTriangle, Eye, EyeOff} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import type {SetStatus} from "./taskRowModel";

const icons = {shown: Eye, hidden: EyeOff, broken: AlertTriangle} as const;

// A set's state as one icon with a tooltip: shown, hidden or cannot work.
// `setName` names the set (task rows in «Групи й порядок» inherit it).
export function SetStatusIcon({status, setName}: {status: SetStatus; setName?: string}) {
    const Icon = icons[status];
    const state = t(`manage.challenges.set.status.${status}`);
    const tip = setName ? t("manage.challenges.set.statusOf", {name: setName, state}) : state;
    return <EventTooltip content={tip}>{id => <span className={`event-set-status is-${status}`} role="img" tabIndex={0} aria-label={tip} aria-describedby={id}><Icon size={16} aria-hidden="true" /></span>}</EventTooltip>;
}
