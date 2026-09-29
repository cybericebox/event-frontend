"use client";

import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {localFromISO, localToISO, parseLocalDate} from "@/components/ui/dateTimePicker";

export type DateMode = "date" | "datetime";

// A «Дата» value in its stored form: a day ("YYYY-MM-DD") picked as is, or a
// moment picked in the viewer's local time and kept as UTC ISO. "" is empty.
export function DateAnswerInput({mode, value, onChange, ariaLabel, id, disabled = false, allowClear = true}: {
    mode: DateMode;
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    id?: string;
    disabled?: boolean;
    allowClear?: boolean;
}) {
    if (mode === "date") return <EventDateTimePicker id={id} dateOnly value={value} onChange={onChange} ariaLabel={ariaLabel} disabled={disabled} allowClear={allowClear} />;
    return <EventDateTimePicker id={id} value={localFromISO(value)} onChange={local => onChange(local ? localToISO(local) ?? "" : "")} ariaLabel={ariaLabel} disabled={disabled} allowClear={allowClear} />;
}

// A stored «Дата» value for reading: the day, or the local date and time.
export function formatDateAnswer(mode: DateMode, value: string): string {
    if (mode === "date") {
        const day = parseLocalDate(value);
        return day ? new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long", year: "numeric"}).format(day).replace(/\s*р\.$/, "") : value;
    }
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? value : new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"}).format(at);
}
