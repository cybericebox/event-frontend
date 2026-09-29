"use client";

import {CircleHelp} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

export function ManageFieldLabel({title, help, htmlFor, required = false, helpPlacement = "top"}: {
    title: string; help: string; htmlFor?: string; required?: boolean; helpPlacement?: "top" | "bottom";
}) {
    const content = <>{title}{required && <span className="event-field-required" aria-label={t("manage.fields.requiredField")}>*</span>}</>;
    return <div className="event-brand-field__head">{htmlFor ? <label htmlFor={htmlFor}>{content}</label> : <span>{content}</span>}<EventTooltip placement={helpPlacement} content={<span className="event-brand-tooltip-copy">{help}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title})} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>;
}
