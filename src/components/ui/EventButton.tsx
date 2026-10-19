"use client";

import type {ButtonHTMLAttributes} from "react";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";

// Small pulsing event logo (crest fallback) for busy controls; never a spinner.
export function BusyMark() {
    return <EventBrandLogo className="ib-busy-mark" size={16} />;
}

// A button that can be busy must say what it is doing: `busyLabel` is required whenever `busy` is passed.
type BusyProps = {busy?: false; busyLabel?: string} | {busy: boolean; busyLabel: string};

// A native button with a `busy` state (AGENTS.md «Busy buttons show the operation»): while busy it is disabled and
// shows the event logo with the operation in the present tense («Зберігаємо…») in place of its icon and label.
// Both faces share one grid cell, so the button keeps the width of the wider one and never jumps; the hidden face
// stays out of the accessible name.
export function EventButton({busy = false, busyLabel, saveDirty, disabled, className = "", children, type = "button", ...props}: ButtonHTMLAttributes<HTMLButtonElement> & BusyProps & {saveDirty?: boolean}) {
    return <button {...props} type={type} className={busy ? `${className} is-busy` : className} disabled={disabled || busy || saveDirty === false} data-busy={busy || undefined}>
        {busyLabel === undefined ? children : <span className="event-btn__faces">
            <span className="event-btn__face" aria-hidden={busy || undefined}>{children}</span>
            <span className="event-btn__face event-btn__face--busy" aria-hidden={!busy || undefined}>{busy ? <BusyMark /> : <span className="ib-busy-mark" />}{busyLabel}</span>
        </span>}
    </button>;
}
