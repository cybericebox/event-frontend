"use client";

import type {ButtonHTMLAttributes} from "react";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";

// Small pulsing event logo (crest fallback) for busy controls; never a spinner.
export function BusyMark() {
    return <EventBrandLogo className="ib-busy-mark" size={16} />;
}

// A native button with a `busy` state, like admin's Button: while busy it is
// disabled, shows the busy mark in place of its icon and keeps its label.
export function EventButton({busy = false, disabled, className = "", children, type = "button", ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {busy?: boolean}) {
    return <button {...props} type={type} className={busy ? `${className} is-busy` : className} disabled={disabled || busy} aria-busy={busy || undefined}>
        {busy && <BusyMark />}{children}
    </button>;
}
