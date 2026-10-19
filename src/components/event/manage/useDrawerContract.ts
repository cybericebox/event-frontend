"use client";

import {useEffect, type RefObject} from "react";

const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// The modal contract of a dialog for the off-canvas menu: focus moves in when it opens, Tab stays
// inside, Esc closes, and focus goes back to the button that opened it. The page behind is inert
// (`behind`: one region or several, e.g. the content and the top bar around the menu button).
export function useDrawerContract({open, onClose, drawer, opener, behind}: {
    open: boolean;
    onClose: () => void;
    drawer: RefObject<HTMLElement | null>;
    opener: RefObject<HTMLElement | null>;
    behind: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[];
}) {
    useEffect(() => {
        const found = drawer.current;
        const back = opener.current;
        const rest = (Array.isArray(behind) ? behind : [behind]).map(ref => ref.current).filter(node => node !== null);
        if (!open || !found) return;
        const panel: HTMLElement = found;
        rest.forEach(node => node.setAttribute("inert", ""));
        const items = () => Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(item => !item.closest("[hidden]") && getComputedStyle(item).display !== "none");
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
            rest.forEach(node => node.removeAttribute("inert"));
            back?.focus({preventScroll: true});
        };
    }, [open, onClose, drawer, opener, behind]);
}
