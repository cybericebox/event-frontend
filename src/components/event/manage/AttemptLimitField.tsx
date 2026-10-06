"use client";

import {useState} from "react";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {MAX_FLAG_ATTEMPTS} from "@/api/attemptLimit";
import {t} from "@/i18n/t";
import {parseAttemptLimit} from "./attemptLimitModel";

// A flag attempt limit (event or task). The field types freely and saves on leaving it or on Enter, only when the
// value is valid and changed; it never disables itself while a save is pending. Esc drops the unsaved text.
export function AttemptLimitField({id, title, help, value, placeholder, disabled, onCommit}: {
    id: string; title: string; help: string; value: number | null; placeholder: string; disabled: boolean; onCommit: (value: number | null) => void;
}) {
    // null follows the saved value; a string is what the manager is typing.
    const [draft, setDraft] = useState<string | null>(null);
    const text = draft ?? (value === null ? "" : String(value));
    const parsed = parseAttemptLimit(text);

    function commit() {
        if (draft === null) return;
        if (!parsed.valid) return;
        setDraft(null);
        if (parsed.value !== value) onCommit(parsed.value);
    }

    return <div className="event-manage-field">
        <ManageFieldLabel htmlFor={id} title={title} help={help} />
        <input id={id} className="event-manage-input" type="number" inputMode="numeric" min={1} max={MAX_FLAG_ATTEMPTS} step={1} value={text} placeholder={placeholder}
            aria-invalid={!parsed.valid} aria-describedby={parsed.valid ? undefined : `${id}-error`} disabled={disabled}
            onChange={changeEvent => setDraft(changeEvent.target.value)} onBlur={commit}
            onKeyDown={keyEvent => {
                if (keyEvent.key === "Enter") {keyEvent.preventDefault(); commit();}
                if (keyEvent.key === "Escape") setDraft(null);
            }} />
        {!parsed.valid && <p className="event-manage-validation" id={`${id}-error`} role="alert">{t("manage.challenges.attempts.invalid")}</p>}
    </div>;
}
