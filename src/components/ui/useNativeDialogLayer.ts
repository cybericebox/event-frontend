"use client";

import {useCallback, useEffect, useRef, type RefObject} from "react";

type HiddenState = {count: number; inert: string | null; ariaHidden: string | null};
const hidden = new WeakMap<HTMLElement, HiddenState>();
const layers: HTMLDialogElement[] = [];
let scrollState: {style: string | null; rootOverflow: string; locked: string | null; x: number; y: number} | null = null;

function hide(element: HTMLElement): () => void {
    const existing = hidden.get(element);
    const state = existing ?? {count: 0, inert: element.getAttribute("inert"), ariaHidden: element.getAttribute("aria-hidden")};
    state.count++; hidden.set(element, state);
    element.setAttribute("inert", ""); element.setAttribute("aria-hidden", "true");
    return () => {
        if (--state.count > 0) return;
        if (state.inert === null) element.removeAttribute("inert"); else element.setAttribute("inert", state.inert);
        if (state.ariaHidden === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", state.ariaHidden);
        hidden.delete(element);
    };
}

function acquire(dialog: HTMLDialogElement): () => void {
    if (!layers.length) {
        scrollState = {style: document.body.getAttribute("style"), rootOverflow: document.documentElement.style.overflow, locked: document.body.getAttribute("data-scroll-locked"), x: window.scrollX, y: window.scrollY};
        document.documentElement.style.overflow = "hidden";
        Object.assign(document.body.style, {position: "fixed", top: `${-scrollState.y}px`, left: `${-scrollState.x}px`, right: "0", width: "100%", overflow: "hidden"});
        document.body.setAttribute("data-scroll-locked", "");
    }
    const descendant = layers.findIndex(layer => dialog.contains(layer));
    if (descendant >= 0) layers.splice(descendant, 0, dialog); else layers.push(dialog);
    const restore: (() => void)[] = [];
    // Native showModal already makes the document inert. Mirror that state on
    // background siblings for assistive technology, never disabling a nested or
    // sibling native dialog that can enter the top layer (VPN / confirmation).
    let node: HTMLElement = dialog;
    while (node.parentElement) {
        for (const sibling of node.parentElement.children) {
            if (!(sibling instanceof HTMLElement) || sibling === node || sibling.matches("dialog,script,style") || sibling.querySelector("dialog")) continue;
            restore.push(hide(sibling));
        }
        if (node.parentElement === document.body) break;
        node = node.parentElement;
    }
    return () => {
        restore.reverse().forEach(release => release());
        const index = layers.lastIndexOf(dialog); if (index >= 0) layers.splice(index, 1);
        if (layers.length || !scrollState) return;
        const previous = scrollState; scrollState = null;
        if (previous.style === null) document.body.removeAttribute("style"); else document.body.setAttribute("style", previous.style);
        // A Radix menu (modal) holds pointer-events: none on the body while it is open. A dialog opened from a menu
        // choice saw it in the style it saved, but the menu has closed since: restoring it would leave the whole page
        // dead until a reload (owner, 2026-10-25, «Скопіювати з…»). The menu restores its own value when it closes.
        if (document.body.style.pointerEvents === "none" && !document.querySelector("[data-radix-popper-content-wrapper]")) document.body.style.removeProperty("pointer-events");
        document.documentElement.style.overflow = previous.rootOverflow;
        if (previous.locked === null) document.body.removeAttribute("data-scroll-locked"); else document.body.setAttribute("data-scroll-locked", previous.locked);
        if (window.scrollX !== previous.x || window.scrollY !== previous.y) window.scrollTo(previous.x, previous.y);
    };
}

// Native dialogs provide top-layer backdrops and focus isolation. This shared
// layer adds nested-safe document scroll locking and explicit background state.
export function useNativeDialogLayer(ref: RefObject<HTMLDialogElement | null>, open: boolean) {
    const releaseRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!open || !dialog?.open) return;
        let release: (() => void) | null = acquire(dialog);
        const close = () => {release?.(); release = null;};
        releaseRef.current = close;
        const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]'))
            .filter(item => item.tabIndex >= 0 && !item.closest('[hidden],[inert],[aria-hidden="true"],dialog:not([open])'));
        const key = (event: KeyboardEvent) => {
            if (layers.at(-1) !== dialog || event.key !== "Tab") return;
            const items = focusable(); const active = document.activeElement;
            if (!items.length) {event.preventDefault(); dialog.focus(); return;}
            if (event.shiftKey && (active === items[0] || !items.includes(active as HTMLElement))) {event.preventDefault(); items.at(-1)?.focus();}
            else if (!event.shiftKey && (active === items.at(-1) || !items.includes(active as HTMLElement))) {event.preventDefault(); items[0].focus();}
        };
        const focus = (event: FocusEvent) => {
            if (layers.at(-1) !== dialog || !(event.target instanceof HTMLElement) || dialog.contains(event.target)) return;
            // Another native dialog may open and focus before its effect registers.
            if (event.target.closest("dialog[open]")) return;
            (focusable()[0] ?? dialog).focus();
        };
        dialog.addEventListener("close", close);
        dialog.addEventListener("keydown", key);
        document.addEventListener("focusin", focus);
        return () => {dialog.removeEventListener("close", close); dialog.removeEventListener("keydown", key); document.removeEventListener("focusin", focus); close();};
    }, [ref, open]);
    return useCallback(() => releaseRef.current?.(), []);
}
