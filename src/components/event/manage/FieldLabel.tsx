"use client";

import {CircleHelp} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

export function FieldLabel({label, required = false, help, htmlFor}: {label: string; required?: boolean; help?: string; htmlFor?: string}) {
    const text = <>{label}{required && <span className="event-content-editor__required" aria-label={t("manage.fields.requiredField")}>*</span>}</>;
    return <span className="event-content-editor__field-label">{htmlFor ? <label htmlFor={htmlFor}>{text}</label> : text}{help && <EventTooltip content={help}>{id => <button className="event-content-editor__help" type="button" aria-label={t("manage.fields.helpFor", {label})} aria-describedby={id} onClick={event => event.preventDefault()}><CircleHelp size={14} aria-hidden="true" /></button>}</EventTooltip>}</span>;
}
