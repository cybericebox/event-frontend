"use client";

import {useId, useLayoutEffect, useRef, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {CircleHelp} from "lucide-react";
import "./invites.css";

const margin = 8;
const gap = 6;

// A (?) help tooltip that is safe inside dialogs: the bubble is portalled to
// the dialog backdrop (or the body) with fixed positioning, so no scroll box
// clips it; it prefers the space above, flips below, and shifts to stay
// inside the viewport. Hover and keyboard focus show it; Escape hides it.
export function HelpTooltip({label, text}: {label: string; text: string}) {
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const bubble = useRef<HTMLSpanElement>(null);
    const [host, setHost] = useState<HTMLElement | null>(null);
    const open = host !== null;
    const [position, setPosition] = useState<{left: number; top: number} | null>(null);

    useLayoutEffect(() => {
        if (!open) return;
        const anchor = trigger.current?.getBoundingClientRect();
        const box = bubble.current?.getBoundingClientRect();
        if (!anchor || !box) return;
        const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - box.width / 2), window.innerWidth - box.width - margin);
        const above = anchor.top - gap - box.height;
        const top = above >= margin ? above : Math.min(anchor.bottom + gap, window.innerHeight - box.height - margin);
        setPosition({left: Math.max(margin, left), top: Math.max(margin, top)});
    }, [open]);

    const lines = text.split("\n").filter(Boolean);
    const content: ReactNode = <span className="event-help-tip__copy">{lines.map((line, index) => line.startsWith("• ")
        ? <span className="event-help-tip__point" key={index}>{line.slice(2)}</span>
        : <span key={index}>{line}</span>)}</span>;
    const show = () => setHost((trigger.current?.closest(".ib-modal-backdrop") as HTMLElement | null) ?? document.body);
    const hide = () => {setHost(null); setPosition(null);};

    return <>
        <button ref={trigger} className="event-brand-help" type="button" aria-label={label} aria-describedby={open ? id : undefined}
            onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}
            onKeyDown={event => {if (event.key === "Escape" && open) {event.stopPropagation(); hide();}}}>
            <CircleHelp size={15} />
        </button>
        {host && createPortal(<span ref={bubble} id={id} role="tooltip" className="event-help-tip"
            style={{left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden"}}>{content}</span>, host)}
    </>;
}
