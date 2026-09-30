"use client";

import type {InputHTMLAttributes} from "react";

type EventNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max" | "step"> & {
    // The text in the field; "" is empty. Read it with parseNumberInput.
    value: string;
    onChange: (value: string) => void;
    // Allow one decimal separator (a comma is stored as a dot).
    decimal?: boolean;
};

const integerPattern = /^\d*$/;
const decimalPattern = /^\d*\.?\d*$/;

// A number field without the browser spinners: a text input that takes only
// digits (and one decimal separator with `decimal`). The form validates range
// and emptiness.
export function EventNumberInput({value, onChange, decimal = false, className = "event-manage-input", ...props}: EventNumberInputProps) {
    return <input {...props} className={className} type="text" inputMode={decimal ? "decimal" : "numeric"} autoComplete="off" spellCheck={false} value={value}
        onChange={change => {
            const next = change.target.value.replace(",", ".");
            if ((decimal ? decimalPattern : integerPattern).test(next)) onChange(next);
        }} />;
}

// "" is not set (null); a positive number is the number; anything else is NaN.
export function parseNumberInput(value: string, integer = false): number | null {
    const text = value.trim();
    if (text === "") return null;
    const number = Number(text);
    if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isInteger(number))) return Number.NaN;
    return number;
}
