"use client";

import {EyeOff} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

// The hidden marker of a team: an eye-off icon, the reason in a tooltip.
export function HiddenMark({moderators = false}: {moderators?: boolean}) {
    const text = t(moderators ? "manage.teams.moderatorsHiddenTip" : "manage.teams.hiddenTip");
    return <EventTooltip content={text}>{id => <span className="event-manage-table__hidden" role="img" aria-label={t("manage.teams.hidden")} aria-describedby={id} tabIndex={0}><EyeOff size={14} aria-hidden="true" /></span>}</EventTooltip>;
}
