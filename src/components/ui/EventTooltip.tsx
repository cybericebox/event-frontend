"use client";

import {useId, useRef, useState, type CSSProperties, type ReactNode} from "react";

export function EventTooltip({content, children, placement = "top"}: {content: ReactNode; children: (id: string) => ReactNode; placement?: "top" | "bottom"}) {
    const id = useId();
    const [dismissed, setDismissed] = useState(false);
    const [shift, setShift] = useState(0);
    const [below, setBelow] = useState(false);
    const bubble = useRef<HTMLSpanElement>(null);
    function position() {
        const node = bubble.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const corrected = rect.left < 12 ? 12 - rect.left : rect.right > window.innerWidth - 12 ? window.innerWidth - 12 - rect.right : 0;
        setShift(previous => previous + corrected);
        setBelow(placement === "top" && rect.top < 12);
    }
    const copy = typeof content === "string" ? content.replaceAll("\\n", "\n") : content;
    const formatted = typeof copy === "string" && copy.includes("\n")
        ? <span className="ib-tip__copy">{copy.split("\n").filter(Boolean).map((line, index) => <span className={line.startsWith("• ") ? "ib-tip__point" : "ib-tip__paragraph"} key={index}>{line.startsWith("• ") ? line.slice(2) : line}</span>)}</span>
        : copy;
    return <span className={`ib-tip${placement === "bottom" || below ? " ib-tip--bottom" : ""}${dismissed ? " is-dismissed" : ""}`} onKeyDown={event => {if (event.key === "Escape") setDismissed(true);}}
        onPointerEnter={position} onFocusCapture={position} onPointerLeave={() => {setDismissed(false); setShift(0); setBelow(false);}} onBlur={() => {setDismissed(false); setShift(0); setBelow(false);}}>
        {children(id)}<span className="ib-tip__bubble" role="tooltip" id={id} ref={bubble} style={{"--ib-tip-shift": `${shift}px`} as CSSProperties}>{formatted}</span>
    </span>;
}
