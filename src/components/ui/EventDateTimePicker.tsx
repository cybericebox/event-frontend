"use client";

import {useEffect, useId, useRef, useState, type KeyboardEvent} from "react";
import * as Popover from "@radix-ui/react-popover";
import {CalendarDays, ChevronLeft, ChevronRight} from "lucide-react";
import {calendarDays, datePart, formatLocal, monthStart, moveDay, parseLocal, parseLocalDate, stepTime, timePart, zoneLabel} from "./dateTimePicker";
import {t} from "@/i18n/t";
import {EventTimePicker} from "./EventTimePicker";
import "./eventDateTimePicker.css";

const weekdays = () => t("ui.datePicker.weekdays").split(",");
const pad = (value: number) => String(value).padStart(2, "0");

function dateLabel(date: Date): string {
    return new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long", year: "numeric"}).format(date).replace(/\s*р\.$/, "");
}

type Part = "hour" | "minute" | "second";
const partMax: Record<Part, number> = {hour: 23, minute: 59, second: 59};

// The one date-time input of the manage screens: a calendar popover and a
// time row. Values are wall-clock strings in the viewer's own time zone
// (shown next to the value); callers send them to the API as UTC ISO.
// dateOnly picks a calendar day: the value is "YYYY-MM-DD", with no time row
// and no time zone. timeOnly is the time row alone: a local "HH:MM".
export function EventDateTimePicker({timeOnly = false, ...props}: Parameters<typeof DateTimePicker>[0] & {timeOnly?: boolean}) {
    if (timeOnly) return <EventTimePicker value={props.value} onChange={props.onChange} ariaLabel={props.ariaLabel} id={props.id} disabled={props.disabled} allowClear={props.allowClear} />;
    return <DateTimePicker {...props} />;
}

function DateTimePicker({value, onChange, disabled = false, ariaLabel, id, allowClear = false, showSeconds = false, dateOnly = false, placeholder}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    ariaLabel: string;
    id?: string;
    allowClear?: boolean;
    showSeconds?: boolean;
    dateOnly?: boolean;
    placeholder?: string;
}) {
    const chosen = dateOnly ? parseLocalDate(value) : parseLocal(value);
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState<Date>(() => chosen ?? new Date());
    const [month, setMonth] = useState<Date>(() => monthStart(chosen ?? new Date()));
    const [drafts, setDrafts] = useState<Record<Part, string> | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // Inside a native <dialog> (top layer) the popover must render in it.
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const moved = useRef(false);
    const calendarId = useId();
    const {zone, offset} = zoneLabel(chosen ?? undefined);
    const time = {hour: chosen?.getHours() ?? 9, minute: chosen?.getMinutes() ?? 0, second: chosen?.getSeconds() ?? 0};
    const shown = drafts ?? {hour: pad(time.hour), minute: pad(time.minute), second: pad(time.second)};
    const days = calendarDays(month);

    // Keyboard moves in the grid bring focus to the new day after it renders.
    useEffect(() => {
        if (!open || !moved.current) return;
        moved.current = false;
        gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${datePart(focused)}"]`)?.focus();
    }, [focused, open]);

    function openChange(next: boolean) {
        if (next) {
            const start = chosen ?? new Date();
            setFocused(start);
            setMonth(monthStart(start));
            setDrafts(null);
            setContainer(triggerRef.current?.closest("dialog") ?? null);
        }
        setOpen(next);
    }

    function emit(day: Date, parts: {hour: number; minute: number; second: number}) {
        if (dateOnly) {onChange(datePart(day)); return;}
        onChange(formatLocal(new Date(day.getFullYear(), day.getMonth(), day.getDate(), parts.hour, parts.minute, showSeconds ? parts.second : 0), showSeconds));
    }

    function pick(day: Date) {
        setFocused(day);
        if (day.getMonth() !== month.getMonth()) setMonth(monthStart(day));
        emit(day, time);
    }

    function focusDay(day: Date) {
        moved.current = true;
        setFocused(day);
        if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) setMonth(monthStart(day));
    }

    function dayKey(event: KeyboardEvent<HTMLButtonElement>, day: Date) {
        const next = moveDay(day, event.key, event.shiftKey);
        if (!next) return;
        event.preventDefault();
        focusDay(next);
    }

    function changeMonth(delta: number) {
        const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
        setMonth(next);
        setFocused(new Date(next.getFullYear(), next.getMonth(), Math.min(focused.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())));
    }

    // Time works before a day is chosen too: it then applies to today.
    function commitPart(part: Part, raw: string) {
        if (drafts === null) return;
        const parsed = timePart(raw, partMax[part]);
        setDrafts(null);
        if (parsed === null) return;
        emit(chosen ?? new Date(), {...time, [part]: parsed});
    }

    function typePart(part: Part, raw: string) {
        const digits = raw.replace(/\D/g, "").slice(0, 2);
        setDrafts({...shown, [part]: digits});
        // Two digits are a whole value: apply at once.
        if (digits.length === 2 && timePart(digits, partMax[part]) !== null) emit(chosen ?? new Date(), {...time, [part]: Number(digits)});
    }

    function partKey(event: KeyboardEvent<HTMLInputElement>, part: Part) {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setDrafts(null);
            emit(chosen ?? new Date(), {...time, [part]: stepTime(time[part], event.key === "ArrowUp" ? 1 : -1, partMax[part])});
        } else if (event.key === "Enter") {
            event.preventDefault();
            commitPart(part, event.currentTarget.value);
        }
    }

    const parts: Part[] = showSeconds ? ["hour", "minute", "second"] : ["hour", "minute"];
    const today = datePart(new Date());

    return <Popover.Root open={open} onOpenChange={openChange}>
        <Popover.Trigger ref={triggerRef} id={id} type="button" className="event-manage-input event-date-picker__trigger" aria-label={ariaLabel} aria-haspopup="dialog" disabled={disabled}>
            <span className={chosen ? "event-date-picker__value" : "event-date-picker__placeholder"}>{chosen ? dateOnly ? dateLabel(chosen) : t("ui.datePicker.value", {date: dateLabel(chosen), time: `${pad(time.hour)}:${pad(time.minute)}${showSeconds ? `:${pad(time.second)}` : ""}`}) : placeholder ?? t("ui.datePicker.placeholder")}</span>
            {chosen && !dateOnly && <span className="event-date-picker__zone" title={zone}>{offset}</span>}
            <CalendarDays size={17} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal container={container ?? undefined}>
            <Popover.Content className="event-date-picker__popover" align="start" sideOffset={4} collisionPadding={8} aria-label={ariaLabel}
                onOpenAutoFocus={event => { event.preventDefault(); gridRef.current?.querySelector<HTMLButtonElement>("[tabindex='0']")?.focus(); }}>
                <div className="event-date-picker__month">
                    <button type="button" aria-label={t("ui.datePicker.prevMonth")} onClick={() => changeMonth(-1)}><ChevronLeft size={17} aria-hidden="true" /></button>
                    <strong aria-live="polite" id={`${calendarId}-month`}>{new Intl.DateTimeFormat("uk-UA", {month: "long", year: "numeric"}).format(month)}</strong>
                    <button type="button" aria-label={t("ui.datePicker.nextMonth")} onClick={() => changeMonth(1)}><ChevronRight size={17} aria-hidden="true" /></button>
                </div>
                <div className="event-date-picker__weekdays" aria-hidden="true">{weekdays().map(day => <span key={day}>{day}</span>)}</div>
                <div ref={gridRef} role="group" aria-labelledby={`${calendarId}-month`} className="event-date-picker__days">
                    {days.map(day => {
                        const key = datePart(day);
                        const selected = !!chosen && key === datePart(chosen);
                        return <button key={key} data-day={key} type="button" tabIndex={key === datePart(focused) ? 0 : -1}
                            className={`event-date-picker__day${day.getMonth() === month.getMonth() ? "" : " is-other-month"}${selected ? " is-selected" : ""}${key === today ? " is-today" : ""}`}
                            aria-label={dateLabel(day)} aria-pressed={selected} aria-current={key === today ? "date" : undefined}
                            onClick={() => pick(day)} onKeyDown={event => dayKey(event, day)}>{day.getDate()}</button>;
                    })}
                </div>
                <div className="event-date-picker__footer">
                    {!dateOnly && <div className="event-date-picker__time" role="group" aria-label={t("ui.datePicker.time")}>
                        <span>{t("ui.datePicker.time")}</span>
                        {parts.map((part, index) => <span className="event-date-picker__part" key={part}>
                            {index > 0 && <span aria-hidden="true">:</span>}
                            <input aria-label={t(`ui.datePicker.${part}`)} inputMode="numeric" autoComplete="off" maxLength={2} value={shown[part]}
                                onFocus={event => event.currentTarget.select()} onChange={event => typePart(part, event.target.value)}
                                onBlur={event => commitPart(part, event.currentTarget.value)} onKeyDown={event => partKey(event, part)} />
                        </span>)}
                        <span className="event-date-picker__zone" title={zone}>{t("ui.datePicker.zone", {zone, offset})}</span>
                    </div>}
                    <div className="event-date-picker__actions">
                        {allowClear && chosen && <button className="ib-btn" type="button" onClick={() => { onChange(""); setOpen(false); }}>{t("ui.datePicker.noDate")}</button>}
                        <Popover.Close className="ib-btn ib-btn--primary" type="button">{t("common.done")}</Popover.Close>
                    </div>
                </div>
            </Popover.Content>
        </Popover.Portal>
    </Popover.Root>;
}
