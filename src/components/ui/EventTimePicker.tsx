"use client";

import {useState, type KeyboardEvent} from "react";
import {X} from "lucide-react";
import {stepTime, timePart} from "./dateTimePicker";
import {t} from "@/i18n/t";
import "./eventDateTimePicker.css";

type Part = "hour" | "minute";
const partMax: Record<Part, number> = {hour: 23, minute: 59};
const pad = (value: number) => String(value).padStart(2, "0");

// The time row of EventDateTimePicker on its own: a local time of day as
// "HH:MM" ("" for none). Typing two digits applies a part; the arrows step it.
export function EventTimePicker({value, onChange, ariaLabel, id, disabled = false, allowClear = false}: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    id?: string;
    disabled?: boolean;
    allowClear?: boolean;
}) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    const time = match ? {hour: Number(match[1]), minute: Number(match[2])} : null;
    const [drafts, setDrafts] = useState<Record<Part, string> | null>(null);
    const shown = drafts ?? {hour: time ? pad(time.hour) : "", minute: time ? pad(time.minute) : ""};

    function emit(parts: Record<Part, number>) { onChange(`${pad(parts.hour)}:${pad(parts.minute)}`); }
    const base = time ?? {hour: 0, minute: 0};

    function commit(part: Part, raw: string) {
        if (drafts === null) return;
        setDrafts(null);
        const parsed = timePart(raw, partMax[part]);
        if (parsed !== null) emit({...base, [part]: parsed});
    }

    function type(part: Part, raw: string) {
        const digits = raw.replace(/\D/g, "").slice(0, 2);
        setDrafts({...shown, [part]: digits});
        if (digits.length === 2 && timePart(digits, partMax[part]) !== null) emit({...base, [part]: Number(digits)});
    }

    function key(event: KeyboardEvent<HTMLInputElement>, part: Part) {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setDrafts(null);
            emit({...base, [part]: stepTime(base[part], event.key === "ArrowUp" ? 1 : -1, partMax[part])});
        } else if (event.key === "Enter") {
            event.preventDefault();
            commit(part, event.currentTarget.value);
        }
    }

    return <div className="event-date-picker__time event-time-picker" role="group" aria-label={ariaLabel} id={id}>
        {(["hour", "minute"] as Part[]).map((part, index) => <span className="event-date-picker__part" key={part}>
            {index > 0 && <span aria-hidden="true">:</span>}
            <input aria-label={t(`ui.datePicker.${part}`)} inputMode="numeric" autoComplete="off" maxLength={2} placeholder="--" value={shown[part]} disabled={disabled}
                onFocus={event => event.currentTarget.select()} onChange={event => type(part, event.target.value)}
                onBlur={event => commit(part, event.currentTarget.value)} onKeyDown={event => key(event, part)} />
        </span>)}
        {allowClear && time && !disabled && <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("ui.timePicker.clear")} onClick={() => {setDrafts(null); onChange("");}}><X size={16} /></button>}
    </div>;
}
