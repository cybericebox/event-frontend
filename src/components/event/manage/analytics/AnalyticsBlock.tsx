"use client";

import type {ReactNode} from "react";
import {useState} from "react";
import {toast} from "react-hot-toast";
import {CircleHelp, Download} from "lucide-react";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";
import {analyticsTableExportPath, type CommunicationsTable, type ParticipantsTable} from "@/api/manageAnalyticsPeople";
import type {AnalyticsPeriod} from "@/api/manageAnalytics";
import {EventButton} from "@/components/ui/EventButton";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import "./analytics.css";
import "./people.css";

// One block of a section page: the heading with its hint (?) and actions, then
// the content (a chart, a table or a list) that keeps its own constant size.
export function AnalyticsBlock({title, subtitle, hint, actions, className = "", children}: {
    title: string;
    subtitle?: string;
    hint: string;
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return <section className={`event-analytics__block${className ? ` ${className}` : ""}`} aria-label={title}>
        <div className="event-analytics__block-head">
            <div className="event-analytics-people__title">
                <h2>{title}</h2>
                <EventTooltip content={hint}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title})} aria-describedby={id}><CircleHelp size={14} /></button>}</EventTooltip>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="event-analytics-people__actions">{actions}</div>}
        </div>
        {children}
    </section>;
}

// The CSV of one table of a section (`export.csv?table=`), in a block heading.
export function AnalyticsTableExport({eventID, section, table, period, disabled = false}: {
    eventID: string;
    section: "participants" | "communications";
    table: ParticipantsTable | CommunicationsTable;
    period: AnalyticsPeriod;
    disabled?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    async function download() {
        setBusy(true);
        try {await downloadManageCSV(eventID, analyticsTableExportPath(section, table, period), csvFileName(`analytics-${section}-${table}`));}
        catch {toast.error(t("manage.analytics.exportFailed"));}
        finally {setBusy(false);}
    }
    return <EventButton className="ib-btn ib-btn--sm" type="button" disabled={disabled || busy} busy={busy} onClick={() => void download()}><Download size={14} aria-hidden="true" /> {t("manage.analytics.export")}</EventButton>;
}
