"use client";

import {useId, useState, type ReactNode} from "react";
import {CircleHelp} from "lucide-react";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {t} from "@/i18n/t";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";

// One setting of the Live editor in the /manage form style: the label with
// its (?) help and the required mark, the control, then an optional note
// (a recommendation) or warning under it.
export function LiveField({label, help, required = false, note, warning, children}: {
    label: string; help: string; required?: boolean; note?: ReactNode; warning?: ReactNode;
    children: (id: string) => ReactNode;
}) {
    const id = useId();
    return <div className="event-live-field">
        <ManageFieldLabel title={label} help={help} htmlFor={id} required={required} />
        {children(id)}
        {note && <small>{note}</small>}
        {warning && <small className="event-live-field__warning" role="status">{warning}</small>}
    </div>;
}

// A whole number in [min, max]: typing keeps a draft, every valid value is
// applied at once, and leaving the field restores the last valid one.
export function LiveNumberInput({id, value, min, max, disabled, onChange}: {id: string; value: number; min: number; max: number; disabled: boolean; onChange: (value: number) => void}) {
    const [draft, setDraft] = useState<string | null>(null);
    return <input id={id} className="event-manage-input" type="number" inputMode="numeric" min={min} max={max} step={1} disabled={disabled}
        value={draft ?? (Number.isFinite(value) ? value : "")}
        onChange={event => {
            setDraft(event.target.value);
            const next = event.target.valueAsNumber;
            if (Number.isInteger(next) && next >= min && next <= max) onChange(next);
        }}
        onBlur={() => setDraft(null)} />;
}

// A labelled segmented choice (S / M / L, mode) in the same field frame.
export function LiveSegmented<T extends string>({label, help, value, options, disabled, onChange}: {
    label: string; help: string; value: T; options: {value: T; label: string}[]; disabled: boolean; onChange: (value: T) => void;
}) {
    return <div className="event-live-field">
        <ManageFieldLabel title={label} help={help} />
        <div className="ib-seg ib-seg--block" role="group" aria-label={label}>
            {options.map(option => <button key={option.value} type="button" disabled={disabled} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
        </div>
    </div>;
}

// An on/off setting: the switch with its label beside it and the (?) help.
export function LiveSwitch({label, help, checked, disabled, onChange}: {label: string; help: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void}) {
    return <div className="event-live-switch">
        <EventSwitch checked={checked} disabled={disabled} onCheckedChange={onChange} label={label} />
        <EventTooltip content={<span className="event-brand-tooltip-copy">{help}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: label})} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
    </div>;
}
