"use client";

import type {ReactNode} from "react";
import {CircleHelp} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import "../analytics.css";
import "./tasks.css";

// A block of «Завдання» / «Прогрес»: the heading with its hint (?) and actions,
// then the content (a chart or a table) that keeps its own constant size.
export function SectionBlock({title, subtitle, hint, actions, children}: {
    title: string; subtitle?: string; hint: string; actions?: ReactNode; children: ReactNode;
}) {
    return <section className="event-analytics__block" aria-label={title}>
        <div className="event-analytics__block-head">
            <div className="event-analytics-tasks__title">
                <h2>{title}</h2>
                <HelpButton label={title} hint={hint} />
                {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="event-analytics-tasks__actions">{actions}</div>}
        </div>
        {children}
    </section>;
}

// The (?) that explains a heading or a column.
export function HelpButton({label, hint, size = 14}: {label: string; hint: string; size?: number}) {
    return <EventTooltip content={hint}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: label})} aria-describedby={id}><CircleHelp size={size} /></button>}</EventTooltip>;
}

// A column heading with its (?).
export function HelpHead({label, hint, numeric = false}: {label: string; hint: string; numeric?: boolean}) {
    return <th scope="col" className={numeric ? "ib-num" : undefined}><span className="event-analytics-tasks__th">{label}<HelpButton label={label} hint={hint} size={12} /></span></th>;
}
