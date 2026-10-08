"use client";

import {useState} from "react";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {parsePolicyNumber} from "./labPolicyModel";
import {t} from "@/i18n/t";

// Draft text is local; a valid blur/Enter commits to the parent's optimistic queue.
export function LabPolicyNumberField({id, title, value, min, max, nullable, placeholder, disabled, onCommit}: {
    id: string; title: string; value: number | null; min: number; max: number; nullable: boolean;
    placeholder?: string; disabled: boolean; onCommit: (value: number | null) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const text = draft ?? (value == null ? "" : String(value));
    const parsed = parsePolicyNumber(text, min, max, nullable);
    const invalid = parsed === undefined;
    function commit() {
        if (draft === null || invalid || disabled) return;
        setDraft(null);
        if (parsed !== value) onCommit(parsed);
    }
    return <div className="event-manage-field">
        <ManageFieldLabel htmlFor={id} title={title} help={t("manage.labs.policy.numberHelp", {min, max})} />
        <input id={id} className="event-manage-input" type="number" inputMode="numeric" min={min} max={max} step={1}
            value={text} placeholder={placeholder} disabled={disabled} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => {
                if (event.key === "Enter") {event.preventDefault(); commit();}
                if (event.key === "Escape") setDraft(null);
            }} />
        {invalid && <p className="event-manage-validation" id={`${id}-error`} role="alert">{t("manage.labs.policy.range", {min, max})}</p>}
    </div>;
}
