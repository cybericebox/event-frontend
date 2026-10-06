"use client";

import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {ManageFieldLabel} from "./ManageFieldLabel";

export function ManageDateField({id, title, help, value, onChange, disabled, required}: {
    id: string; title: string; help: string; value: string; onChange: (value: string) => void;
    disabled: boolean; required: boolean;
}) {
    return <div className="event-manage-field"><ManageFieldLabel htmlFor={id} title={title} help={help} required={required} /><EventDateTimePicker id={id} ariaLabel={title} value={value} onChange={onChange} disabled={disabled} /></div>;
}
