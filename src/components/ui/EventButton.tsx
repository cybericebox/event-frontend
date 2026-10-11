"use client";

import type {ButtonHTMLAttributes} from "react";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";

// Small pulsing event logo (crest fallback) for busy controls; never a spinner.
export function BusyMark() {
    return <EventBrandLogo className="ib-busy-mark" size={16} />;
}

// A native button with a `busy` state, like admin's Button: while busy it is
// disabled, shows the busy mark in place of its icon and keeps its label.
export function EventButton({busy = false, saveDirty, disabled, className = "", children, type = "button", style, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {busy?: boolean; saveDirty?: boolean}) {
    // Keep the action's footprint stable without offering a clean form a save.
    const clean = saveDirty === false && !busy;
    return <button {...props} style={clean ? {...style, visibility: "hidden"} : style} aria-hidden={clean || undefined} type={type} className={busy ? `${className} is-busy` : className} disabled={disabled || busy || clean} aria-busy={busy || undefined}>
        {busy && <BusyMark />}{children}
    </button>;
}
