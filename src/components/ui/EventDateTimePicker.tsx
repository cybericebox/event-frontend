"use client";

import {useId, useRef, useState} from "react";
import {CalendarDays, ChevronLeft, ChevronRight} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {t} from "@/i18n/t";

const weekdays = t("ui.datePicker.weekdays").split(",");
const pad = (value: number) => String(value).padStart(2, "0");
const datePart = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function selectedDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(date: Date): string {
    return new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long", year: "numeric"}).format(date).replace(/\s*р\.$/, "");
}

export function EventDateTimePicker({value, onChange, disabled = false, ariaLabel, id, allowClear = false, showSeconds = false}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    ariaLabel: string;
    id?: string;
    allowClear?: boolean;
    showSeconds?: boolean;
}) {
    const chosen = selectedDate(value);
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [month, setMonth] = useState(() => chosen ? new Date(chosen.getFullYear(), chosen.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const calendarId = useId();
    const time = chosen ? `${pad(chosen.getHours())}:${pad(chosen.getMinutes())}${showSeconds ? `:${pad(chosen.getSeconds())}` : ""}` : showSeconds ? "09:00:00" : "09:00";
    const [hourDraft, setHourDraft] = useState(time.slice(0, 2));
    const [minuteDraft, setMinuteDraft] = useState(time.slice(3, 5));
    const [secondDraft, setSecondDraft] = useState(time.slice(6, 8) || "00");
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const days = Array.from({length: 42}, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));

    function commitTime(part: "hour" | "minute" | "second", raw: string) {
        if (!chosen || !/^\d{1,2}$/.test(raw)) {
            if (part === "hour") setHourDraft(time.slice(0, 2));
            else if (part === "minute") setMinuteDraft(time.slice(3, 5));
            else setSecondDraft(time.slice(6, 8) || "00");
            return;
        }
        const next = Number(raw);
        if (next < 0 || next > (part === "hour" ? 23 : 59)) {
            if (part === "hour") setHourDraft(time.slice(0, 2));
            else if (part === "minute") setMinuteDraft(time.slice(3, 5));
            else setSecondDraft(time.slice(6, 8) || "00");
            return;
        }
        const [hour, minute, second = 0] = time.split(":").map(Number);
        if (part === "hour") setHourDraft(pad(next));
        else if (part === "minute") setMinuteDraft(pad(next));
        else setSecondDraft(pad(next));
        onChange(`${datePart(chosen)}T${pad(part === "hour" ? next : hour)}:${pad(part === "minute" ? next : minute)}${showSeconds ? `:${pad(part === "second" ? next : second)}` : ""}`);
    }

    return <div className="event-date-picker">
        <button ref={triggerRef} id={id} type="button" className="event-manage-input event-date-picker__trigger" aria-label={ariaLabel} aria-expanded={open} aria-controls={calendarId} disabled={disabled} onClick={() => {if (!open) {setMonth(chosen ? new Date(chosen.getFullYear(), chosen.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setHourDraft(time.slice(0, 2)); setMinuteDraft(time.slice(3, 5)); setSecondDraft(time.slice(6, 8) || "00");} setOpen(!open);}}>
            <span className={chosen ? "" : "event-date-picker__placeholder"}>{chosen ? `${dateLabel(chosen)}, ${time}` : t("ui.datePicker.placeholder")}</span><CalendarDays size={17} aria-hidden="true" />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent id={calendarId} className="event-date-picker__dialog" onCloseAutoFocus={event => {event.preventDefault(); triggerRef.current?.focus();}}>
                <DialogTitle className="event-date-picker__title">{t("ui.datePicker.placeholder")}</DialogTitle>
                <DialogDescription className="sr-only">{t("ui.datePicker.description")}</DialogDescription>
                <div className="event-date-picker__month"><button type="button" aria-label={t("ui.datePicker.prevMonth")} onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><strong>{new Intl.DateTimeFormat("uk-UA", {month: "long", year: "numeric"}).format(month)}</strong><button type="button" aria-label={t("ui.datePicker.nextMonth")} onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div>
                <div className="event-date-picker__weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
                <div role="grid" aria-label={t("ui.datePicker.calendar")} className="event-date-picker__days">{days.map(day => <button key={datePart(day)} type="button" className={`event-date-picker__day${day.getMonth() === month.getMonth() ? "" : " is-other-month"}${chosen && datePart(day) === datePart(chosen) ? " is-selected" : ""}`} aria-label={dateLabel(day)} aria-current={chosen && datePart(day) === datePart(chosen) ? "date" : undefined} onClick={() => {onChange(`${datePart(day)}T${time}`); setHourDraft(time.slice(0, 2)); setMinuteDraft(time.slice(3, 5)); setSecondDraft(time.slice(6, 8) || "00"); if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));}}>{day.getDate()}</button>)}</div>
                <div className="event-date-picker__footer"><div className="event-date-picker__time"><span>{t("ui.datePicker.time")}</span>{chosen ? <><input aria-label={t("ui.datePicker.hour")} type="number" min="0" max="23" value={hourDraft} onChange={event => setHourDraft(event.target.value)} onBlur={() => commitTime("hour", hourDraft)} onKeyDown={event => {if (event.key === "Enter") {event.preventDefault(); commitTime("hour", hourDraft);}}} /><span>:</span><input aria-label={t("ui.datePicker.minute")} type="number" min="0" max="59" value={minuteDraft} onChange={event => setMinuteDraft(event.target.value)} onBlur={() => commitTime("minute", minuteDraft)} onKeyDown={event => {if (event.key === "Enter") {event.preventDefault(); commitTime("minute", minuteDraft);}}} />{showSeconds && <><span>:</span><input aria-label={t("ui.datePicker.second")} type="number" min="0" max="59" value={secondDraft} onChange={event => setSecondDraft(event.target.value)} onBlur={() => commitTime("second", secondDraft)} onKeyDown={event => {if (event.key === "Enter") {event.preventDefault(); commitTime("second", secondDraft);}}} /></>}</> : <span className="event-date-picker__time-hint">{t("ui.datePicker.timeHint")}</span>}</div><div className="event-date-picker__actions">{allowClear && chosen && <button className="ib-btn" type="button" onClick={() => {onChange(""); setOpen(false);}}>{t("ui.datePicker.noDate")}</button>}<button className="ib-btn ib-btn--primary" type="button" onClick={() => setOpen(false)}>{t("common.done")}</button></div></div>
            </DialogContent>
        </Dialog>
    </div>;
}
