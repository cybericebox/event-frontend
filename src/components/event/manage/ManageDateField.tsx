"use client";

import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {ManageFieldLabel} from "./ManageFieldLabel";

export function ManageDateField({id, title, help, value, onChange, disabled, required, error}: {
    id: string; title: string; help: string; value: string; onChange: (value: string) => void;
    disabled: boolean; required: boolean; error?: string;
}) {
    return <div className="event-manage-field"><ManageFieldLabel htmlFor={id} title={title} help={help} required={required} /><EventDateTimePicker id={id} ariaLabel={title} value={value} onChange={onChange} disabled={disabled} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : undefined} />{error && <p id={`${id}-error`} className="event-manage-validation" role="alert">{error}</p>}</div>;
}
