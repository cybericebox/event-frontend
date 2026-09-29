import type {ReactNode} from "react";

/** One item among several choices or an acceptance: ds-v2 `.ib-check` over a native checkbox. */
export function EventCheckbox({checked, onCheckedChange, disabled = false, label, ariaLabel, id, className = ""}: {
    checked: boolean; onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean; label?: ReactNode; ariaLabel?: string; id?: string; className?: string;
}) {
    return <label className={`ib-check ${className}`.trim()}>
        <input id={id} type="checkbox" checked={checked} disabled={disabled} aria-label={ariaLabel} onChange={event => onCheckedChange?.(event.target.checked)} readOnly={!onCheckedChange} />
        <span className="ib-check__box" aria-hidden="true" />
        {label !== undefined && <span>{label}</span>}
    </label>;
}
