"use client";

import {useEffect, type RefObject} from "react";

const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// The modal contract of a dialog for the off-canvas menu: focus moves in when it opens, Tab stays
// inside, Esc closes, and focus goes back to the button that opened it. The page behind is inert.
export function useDrawerContract({open, onClose, drawer, opener, behind}: {
    open: boolean;
    onClose: () => void;
    drawer: RefObject<HTMLElement | null>;
    opener: RefObject<HTMLElement | null>;
    behind: RefObject<HTMLElement | null>;
}) {
    useEffect(() => {
        const found = drawer.current;
        const back = opener.current;
        const rest = behind.current;
        if (!open || !found) return;
        const panel: HTMLElement = found;
        rest?.setAttribute("inert", "");
        const items = () => Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(item => !item.closest("[hidden]"));
        items()[0]?.focus();
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab") return;
            const list = items();
            if (list.length === 0) return;
            const first = list[0];
            const last = list[list.length - 1];
            if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {event.preventDefault(); last.focus();}
            else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {event.preventDefault(); first.focus();}
        }
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            rest?.removeAttribute("inert");
            back?.focus();
        };
    }, [open, onClose, drawer, opener, behind]);
}
