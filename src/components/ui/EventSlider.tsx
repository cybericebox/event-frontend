"use client";

import {useRef, type KeyboardEvent, type PointerEvent} from "react";
import "./eventSlider.css";

function clamp(value: number, min: number, max: number, step: number): number {
    const stepped = Math.round((value - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(stepped.toFixed(6))));
}

/**
 * ds-v2 slider: a hairline track, an action-coloured fill and a square-ish
 * thumb (no native range input). Pointer drag, click on the track and the
 * arrow / Page / Home / End keys all move it by `step`.
 */
export function EventSlider({value, min, max, step = 1, onValueChange, disabled = false, ariaLabel, valueText, className = ""}: {
    value: number; min: number; max: number; step?: number; onValueChange: (value: number) => void;
    disabled?: boolean; ariaLabel: string; valueText?: string; className?: string;
}) {
    const track = useRef<HTMLDivElement>(null);
    const ratio = (clamp(value, min, max, step) - min) / (max - min);
    function fromPointer(clientX: number) {
        const rect = track.current?.getBoundingClientRect();
        if (!rect || !rect.width) return;
        const next = clamp(min + (clientX - rect.left) / rect.width * (max - min), min, max, step);
        if (next !== value) onValueChange(next);
    }
    function pointerDown(event: PointerEvent<HTMLDivElement>) {
        if (disabled || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        (event.currentTarget.querySelector("[role=slider]") as HTMLElement | null)?.focus();
        fromPointer(event.clientX);
    }
    function keyDown(event: KeyboardEvent<HTMLSpanElement>) {
        const big = Math.max(step, (max - min) / 10);
        const moves: Record<string, number> = {ArrowLeft: value - step, ArrowDown: value - step, ArrowRight: value + step, ArrowUp: value + step, PageDown: value - big, PageUp: value + big, Home: min, End: max};
        if (!(event.key in moves) || disabled) return;
        event.preventDefault();
        const next = clamp(moves[event.key], min, max, step);
        if (next !== value) onValueChange(next);
    }
    return <div className={`ib-slider${disabled ? " is-disabled" : ""} ${className}`.trim()} ref={track}
        onPointerDown={pointerDown} onPointerMove={event => {if (!disabled && event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event.clientX);}}>
        <span className="ib-slider__track" aria-hidden="true"><span className="ib-slider__fill" style={{width: `${ratio * 100}%`}} /></span>
        <span className="ib-slider__thumb" role="slider" tabIndex={disabled ? -1 : 0} aria-label={ariaLabel} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
            aria-valuetext={valueText} aria-disabled={disabled || undefined} style={{left: `${ratio * 100}%`}} onKeyDown={keyDown} />
    </div>;
}
