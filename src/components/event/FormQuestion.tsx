"use client";

import type {ReactNode} from "react";
import {ChevronDown} from "lucide-react";
import {t} from "@/i18n/t";

// The one required mark: the star is decoration, the screen reader hears «Обовʼязкове питання».
export function RequiredMark() {
    return <span className="ib-field__req"><span aria-hidden="true">*</span><span className="ib-sr"> {t("forms.field.required")}</span></span>;
}

// One question of a participant form on the DS `.ib-field`: label (or a legend when the answer is
// a group of controls: several checkboxes, a file, a date), required mark, help, the control and
// the inline error under it. `locked` disables the whole question.
export function FormQuestion({id, label, required = false, help, error, group = false, locked = false, children}: {
    id: string;
    label: string;
    required?: boolean;
    help?: string;
    error?: string;
    group?: boolean;
    locked?: boolean;
    children: ReactNode;
}) {
    const Root = group || locked ? "fieldset" : "div";
    const text = <>{label}{required && <RequiredMark />}</>;
    return <Root className={`ib-field event-join-question${error ? " is-invalid" : ""}`} disabled={locked || undefined}>
        {group ? <legend className="ib-field__label">{text}</legend> : <label className="ib-field__label" htmlFor={id}>{text}</label>}
        {help && <p className="ib-field__hint" id={`${id}-help`}>{help}</p>}
        {children}
        {error && <p className="ib-field__error" id={`${id}-error`} role="alert">{error}</p>}
    </Root>;
}

// Props every simple control of a question takes, so the wiring lives in one place.
export function questionControlProps(id: string, required: boolean, help?: string, error?: string) {
    return {
        id,
        "aria-required": required || undefined,
        "aria-invalid": error ? true as const : undefined,
        "aria-describedby": [help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
    };
}

// Native select in the DS look: `.ib-select` over `select.ib-input` with the chevron.
export function QuestionSelect({value, onChange, options, ...rest}: {
    value: string;
    onChange: (value: string) => void;
    options: readonly string[];
} & ReturnType<typeof questionControlProps>) {
    return <span className="ib-select">
        <select {...rest} className="ib-input" value={value} onChange={event => onChange(event.target.value)}>
            <option value="">{t("common.chooseOption")}</option>
            {options.map(option => <option value={option} key={option}>{option}</option>)}
        </select>
        <ChevronDown aria-hidden="true" />
    </span>;
}

// After a failed submit focus goes to the first question that shows an error.
export function focusFirstInvalid(root: ParentNode | null) {
    const field = root?.querySelector<HTMLElement>(".ib-field.is-invalid");
    const target = field?.querySelector<HTMLElement>("input,select,textarea,button") ?? field;
    target?.focus();
}
