"use client";

import type {ReactNode} from "react";
import "./analytics.css";

// The frame of every analytics section: the page heading with its status and
// actions (live status, export), the period filter under it, then the content.
// Sections put their blocks in `children` and their own controls in `actions`.
export function AnalyticsPage({title, description, actions, filter, className = "", children}: {
    title: string;
    description: string;
    actions?: ReactNode;
    filter?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return <div className={`event-manage-settings event-analytics${className ? ` ${className}` : ""}`}>
        <header className="event-manage-heading">
            <div><h1>{title}</h1><p>{description}</p></div>
            {actions && <div className="event-manage-heading__actions">{actions}</div>}
        </header>
        {filter && <div className="event-analytics__filter">{filter}</div>}
        {children}
    </div>;
}
