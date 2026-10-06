"use client";

import {useState} from "react";
import {REMINDER_MAX_DAYS, REMINDER_MIN_DAYS, validReminderDays} from "@/api/manageNotifications";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "../ManageFieldLabel";

// «За скільки днів до старту»: the lead time of the start reminder. A value is
// saved when the field loses focus or Enter is pressed and it is a whole
// number of days in range; the old value stays otherwise.
export function ReminderDaysField({days, disabled, onCommit}: {days: number; disabled: boolean; onCommit: (days: number) => void}) {
    const [text, setText] = useState(String(days));
    const [shown, setShown] = useState(days);
    if (shown !== days) {setShown(days); setText(String(days));}
    const value = Number(text);
    const invalid = text.trim() === "" || !validReminderDays(value);

    function commit() {
        if (invalid) {setText(String(days)); return;}
        if (value !== days) onCommit(value);
    }

    return <div className="event-manage-field event-manage-notifications__narrow">
        <ManageFieldLabel title={t("manage.notifications.reminder.days")} help={t("manage.notifications.reminder.daysHelp", {min: REMINDER_MIN_DAYS, max: REMINDER_MAX_DAYS})} htmlFor="event-reminder-days" required />
        <input className={`event-manage-input${invalid ? " is-invalid" : ""}`} id="event-reminder-days" type="number" inputMode="numeric" min={REMINDER_MIN_DAYS} max={REMINDER_MAX_DAYS} step={1}
            value={text} disabled={disabled} aria-invalid={invalid} onChange={event => setText(event.target.value)} onBlur={commit}
            onKeyDown={event => {if (event.key === "Enter") {event.preventDefault(); commit();}}} />
        {invalid && <p className="event-content-editor__field-error" role="alert">{t("manage.notifications.reminder.daysRange", {min: REMINDER_MIN_DAYS, max: REMINDER_MAX_DAYS})}</p>}
    </div>;
}
