"use client";

import {useEffect, type RefObject} from "react";

const enabled = (toolbar: HTMLElement) => Array.from(toolbar.querySelectorAll<HTMLElement>("button:not([disabled])")).filter(item => !item.closest("[hidden]"));

// A toolbar is one Tab stop: only the current button is in the tab order, ←/→ and Home/End move between
// the buttons. Plain DOM on the toolbar element, so it works for toolbars whose buttons come from several
// small components.
export function useRovingToolbar(toolbar: RefObject<HTMLElement | null>) {
    // Runs after every render: buttons can appear, disappear or toggle disabled at any time.
    useEffect(() => {
        const root = toolbar.current;
        if (!root) return;
        const all = enabled(root);
        const current = all.find(item => item.tabIndex === 0) ?? all[0];
        for (const item of all) item.tabIndex = item === current ? 0 : -1;
    });
    useEffect(() => {
        const root = toolbar.current;
        if (!root) return;
        const onFocusIn = (event: FocusEvent) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>("button");
            if (!target) return;
            const all = enabled(root);
            if (all.includes(target)) for (const item of all) item.tabIndex = item === target ? 0 : -1;
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const all = enabled(root);
            const index = all.indexOf((event.target as HTMLElement).closest<HTMLElement>("button") as HTMLElement);
            if (index < 0) return;
            const next = event.key === "ArrowRight" ? (index + 1) % all.length : event.key === "ArrowLeft" ? (index - 1 + all.length) % all.length
                : event.key === "Home" ? 0 : event.key === "End" ? all.length - 1 : -1;
            if (next < 0) return;
            event.preventDefault();
            all[next].focus();
        };
        root.addEventListener("focusin", onFocusIn);
        root.addEventListener("keydown", onKeyDown);
        return () => {
            root.removeEventListener("focusin", onFocusIn);
            root.removeEventListener("keydown", onKeyDown);
        };
    }, [toolbar]);
}
