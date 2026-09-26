"use client";

import {CircleHelp} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";

export function ManageFieldLabel({title, help, htmlFor, required = false}: {
    title: string; help: string; htmlFor?: string; required?: boolean;
}) {
    const content = <>{title}{required && <span className="event-field-required" aria-label="Обов’язкове поле">*</span>}</>;
    return <div className="event-brand-field__head">{htmlFor ? <label htmlFor={htmlFor}>{content}</label> : <span>{content}</span>}<EventTooltip content={<span className="event-brand-tooltip-copy">{help}</span>}>{id => <button className="event-brand-help" type="button" aria-label={`Про поле «${title}»`} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>;
}
