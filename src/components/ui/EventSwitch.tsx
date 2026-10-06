import type {ReactNode} from "react";

/** On/off setting: ds-v2 `.ib-switch` over a native checkbox with role="switch". */
export function EventSwitch({checked, onCheckedChange, disabled = false, label, ariaLabel, id, className = ""}: {
    checked: boolean; onCheckedChange: (checked: boolean) => void;
    disabled?: boolean; label?: ReactNode; ariaLabel?: string; id?: string; className?: string;
}) {
    return <label className={`ib-switch ${className}`.trim()}>
        <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} aria-label={ariaLabel} onChange={event => onCheckedChange(event.target.checked)} />
        <span className="ib-switch__track" aria-hidden="true" />
        {label !== undefined && <span>{label}</span>}
    </label>;
}
