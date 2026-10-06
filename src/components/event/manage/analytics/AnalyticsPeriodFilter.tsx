"use client";

import {useId} from "react";
import {RotateCcw} from "lucide-react";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {t} from "@/i18n/t";
import type {useAnalyticsPeriod} from "./useAnalyticsPeriod";
import "./analytics.css";

// The period filter of a section: a from / to pair of the shared date-time
// picker. An empty bound means the event's own start or finish; with
// `open` it means no limit (reports over registration and mail, which start
// before the event does).
export function AnalyticsPeriodFilter({period, open = false}: {period: ReturnType<typeof useAnalyticsPeriod>; open?: boolean}) {
    const id = useId();
    return <div className="event-analytics-period" role="group" aria-label={t("manage.analytics.period.label")}>
        <div className="event-manage-field">
            <ManageFieldLabel htmlFor={`${id}-from`} title={t("manage.analytics.period.from")} help={t(open ? "manage.analytics.period.openFromHelp" : "manage.analytics.period.fromHelp")} />
            <EventDateTimePicker id={`${id}-from`} ariaLabel={t("manage.analytics.period.from")} value={period.draft.from} onChange={period.setFrom} allowClear placeholder={t(open ? "manage.analytics.period.openFrom" : "manage.analytics.period.eventStart")} />
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel htmlFor={`${id}-to`} title={t("manage.analytics.period.to")} help={t(open ? "manage.analytics.period.openToHelp" : "manage.analytics.period.toHelp")} />
            <EventDateTimePicker id={`${id}-to`} ariaLabel={t("manage.analytics.period.to")} value={period.draft.to} onChange={period.setTo} allowClear placeholder={t(open ? "manage.analytics.period.openTo" : "manage.analytics.period.eventEnd")} />
        </div>
        {period.set && <button className="ib-btn ib-btn--sm event-analytics-period__reset" type="button" onClick={period.reset}><RotateCcw size={14} aria-hidden="true" /> {t("manage.analytics.period.reset")}</button>}
        {period.invalid && <p className="event-manage-validation event-analytics-period__error" role="alert">{t("manage.analytics.period.invalid")}</p>}
    </div>;
}
