"use client";

import {useId, useState, type ReactNode} from "react";

export function EventTooltip({content, children, placement = "top"}: {content: ReactNode; children: (id: string) => ReactNode; placement?: "top" | "bottom"}) {
    const id = useId();
    const [dismissed, setDismissed] = useState(false);
    return <span className={`ib-tip${placement === "bottom" ? " ib-tip--bottom" : ""}${dismissed ? " is-dismissed" : ""}`} onKeyDown={event => {if (event.key === "Escape") setDismissed(true);}}
        onPointerLeave={() => setDismissed(false)} onBlur={() => setDismissed(false)}>
        {children(id)}<span className="ib-tip__bubble" role="tooltip" id={id}>{content}</span>
    </span>;
}
