"use client";

import {CircleHelp} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";

export function FieldLabel({label, required = false, help}: {label: string; required?: boolean; help?: string}) {
    return <span className="event-content-editor__field-label">{label}{required && <span className="event-content-editor__required" aria-label="Обов’язкове поле">*</span>}{help && <EventTooltip content={help}>{id => <button className="event-content-editor__help" type="button" aria-label={`Пояснення: ${label}`} aria-describedby={id} onClick={event => event.preventDefault()}><CircleHelp size={14} aria-hidden="true" /></button>}</EventTooltip>}</span>;
}
