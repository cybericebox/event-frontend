"use client";

import {useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode} from "react";

// truncated shows the hint only while the trigger's text is actually cut off by an ellipsis;
// silent keeps a purely visual bubble out of the accessibility tree (its text is read elsewhere);
// help marks a «?» button whose only job is the bubble: a click, tap, Enter or Space toggles it.
type EventTooltipProps = {content: ReactNode; children: (id: string) => ReactNode; placement?: "top" | "bottom"; className?: string; truncated?: boolean; silent?: boolean; floating?: boolean; help?: boolean};

export function EventTooltip(props: EventTooltipProps) {
    return props.floating ? <FloatingEventTooltip {...props} /> : <InlineEventTooltip {...props} />;
}

// A native popover shares the dialog's top layer, escaping its scroll/overflow clipping.
function FloatingEventTooltip({content, children, className, silent = false, placement = "top"}: EventTooltipProps) {
    const id = useId();
    const anchor = useRef<HTMLSpanElement>(null);
    const bubble = useRef<HTMLSpanElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dismissed = useRef(false);
    const [open, setOpen] = useState(false);
    const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    const close = () => { clearTimer(); setOpen(false); };
    useEffect(() => clearTimer, []);
    useLayoutEffect(() => {
        const node = bubble.current;
        const trigger = anchor.current;
        if (!node || !trigger) return;
        if (!open) { node.hidePopover?.(); return; }
        node.showPopover?.();
        const rect = trigger.getBoundingClientRect();
        const box = node.getBoundingClientRect();
        const below = placement === "bottom" || rect.top - box.height - 8 < 12;
        node.style.left = `${Math.max(12, Math.min(window.innerWidth - box.width - 12, rect.left + (rect.width - box.width) / 2))}px`;
        node.style.top = `${Math.max(12, Math.min(window.innerHeight - box.height - 12, below ? rect.bottom + 8 : rect.top - box.height - 8))}px`;
    }, [open, content, placement]);
    useEffect(() => {
        if (!open) return;
        const hide = () => setOpen(false);
        window.addEventListener("scroll", hide, true);
        window.addEventListener("resize", hide);
        window.addEventListener("blur", hide);
        return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); window.removeEventListener("blur", hide); };
    }, [open]);
    return <span ref={anchor} className={`ib-tip ib-tip--floating${className ? ` ${className}` : ""}`}
        onPointerEnter={event => { if (event.pointerType === "touch" || dismissed.current) return; clearTimer(); timer.current = setTimeout(() => setOpen(true), 300); }}
        onPointerLeave={() => { dismissed.current = false; close(); }}
        onPointerDownCapture={event => { if (event.pointerType === "touch") { dismissed.current = true; close(); } }}
        onFocusCapture={() => { if (!dismissed.current) { clearTimer(); setOpen(true); } }}
        onBlurCapture={() => { dismissed.current = false; close(); }}
        onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); dismissed.current = true; close(); } }}>
        {children(id)}<span ref={bubble} id={id} className="ib-tip__bubble" popover="manual" role={silent ? undefined : "tooltip"} aria-hidden={silent || undefined}>{content}</span>
    </span>;
}

// Only one tapped-open bubble at a time: opening another closes this one.
let closeOpenTip: (() => void) | null = null;

// A control at the tap that does its own thing (an enabled button, a link, a field): its tap is not for the bubble.
const actionable = 'a[href],button:not([aria-disabled="true"]),input,select,textarea,summary,label,[role="button"]:not([aria-disabled="true"])';

function InlineEventTooltip({content, children, placement = "top", className, truncated = false, silent = truncated, help = false}: EventTooltipProps) {
    const id = useId();
    const [dismissed, setDismissed] = useState(false);
    const [open, setOpen] = useState(false);
    const [cut, setCut] = useState(false);
    const [shift, setShift] = useState(0);
    const [below, setBelow] = useState(false);
    const root = useRef<HTMLSpanElement>(null);
    const bubble = useRef<HTMLSpanElement>(null);
    const pointer = useRef("");
    function position() {
        const node = bubble.current;
        if (!node) return;
        const trigger = node.previousElementSibling;
        if (truncated && trigger) setCut(trigger.scrollWidth > trigger.clientWidth);
        // A closed bubble is scaled to one point on the trigger's centre line (tooltip-local.css: origin at the bubble's
        // untranslated left edge, the bottom edge above the trigger, the top edge below it), so its box is rebuilt from
        // that point and the unscaled size; the shift is not in it.
        const box = node.getBoundingClientRect();
        const centerX = box.left + box.width / 2;
        const edgeY = box.top + box.height / 2;
        const rect = {left: centerX - node.offsetWidth / 2, right: centerX + node.offsetWidth / 2, top: placement === "bottom" || below ? edgeY : edgeY - node.offsetHeight};
        const scrollBounds = node.closest(".ib-admin-shell__scroll")?.getBoundingClientRect();
        const left = Math.max(12, (scrollBounds?.left ?? 0) + 12);
        const right = Math.min(window.innerWidth - 12, (scrollBounds?.right ?? window.innerWidth) - 12);
        const top = Math.max(12, (scrollBounds?.top ?? 0) + 12);
        setShift(rect.left < left ? left - rect.left : rect.right > right ? right - rect.right : 0);
        setBelow(placement === "top" && rect.top < top);
    }
    const reset = () => {setShift(0); setBelow(false);};
    // Tap (or click, Enter, Space on a «?» help button) toggles the bubble; a tap outside, Esc or another bubble closes it.
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        if (closeOpenTip) closeOpenTip();
        closeOpenTip = close;
        const outside = (event: PointerEvent) => {if (!(event.target instanceof Node) || !root.current?.contains(event.target)) close();};
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            // Only the bubble closes, not the dialog it sits in.
            event.preventDefault();
            event.stopPropagation();
            close();
            setDismissed(true);
        };
        document.addEventListener("pointerdown", outside, true);
        window.addEventListener("keydown", escape, true);
        return () => {
            document.removeEventListener("pointerdown", outside, true);
            window.removeEventListener("keydown", escape, true);
            if (closeOpenTip === close) closeOpenTip = null;
        };
    }, [open]);
    const copy = typeof content === "string" ? content.replaceAll("\\n", "\n") : content;
    const formatted = typeof copy === "string" && copy.includes("\n")
        ? <span className="ib-tip__copy">{copy.split("\n").filter(Boolean).map((line, index) => <span className={line.startsWith("• ") ? "ib-tip__point" : "ib-tip__paragraph"} key={index}>{line.startsWith("• ") ? line.slice(2) : line}</span>)}</span>
        : copy;
    return <span ref={root} className={`ib-tip${help ? " ib-tip--help" : ""}${placement === "bottom" || below ? " ib-tip--bottom" : ""}${open ? " is-open" : ""}${dismissed || (truncated && !cut) ? " is-dismissed" : ""}${className ? ` ${className}` : ""}`}
        onKeyDown={event => {if (event.key === "Escape") setDismissed(true);}}
        onPointerDown={event => {pointer.current = event.pointerType;}}
        onClick={event => {
            if (!(event.target instanceof Element) || bubble.current?.contains(event.target)) return;
            // A help button toggles on every click and key; any other trigger only on touch, and never when the tap
            // runs a control of its own (a disabled one, with aria-disabled, still shows its reason).
            if (!help && (pointer.current === "mouse" || event.target.closest(actionable))) return;
            pointer.current = "";
            if (!open) {position(); setDismissed(false);}
            setOpen(!open);
        }}
        onPointerEnter={position} onFocusCapture={position}
        onPointerLeave={() => {setDismissed(false); if (!open) reset();}} onBlur={() => {setDismissed(false); if (!open) reset();}}>
        {children(id)}<span className="ib-tip__bubble" role={silent ? undefined : "tooltip"} aria-hidden={silent || undefined} id={id} ref={bubble} style={{"--ib-tip-shift": `${shift}px`} as CSSProperties}>{truncated && !cut ? null : formatted}</span>
    </span>;
}
