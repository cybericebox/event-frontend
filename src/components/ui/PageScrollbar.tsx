"use client";

import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from "react";
import {t} from "@/i18n/t";

const INSET = 4;
const MIN_THUMB = 32;

/** Keeps document scrolling native; only the visual scrollbar is replaced. */
export function PageScrollbar() {
    const [metrics, setMetrics] = useState({height: 0, thumb: 0, top: 0, max: 0, percent: 0});
    const [visible, setVisible] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const drag = useRef<{id: number; y: number; scroll: number} | null>(null);
    const focused = useRef(false);
    const hovered = useRef(false);

    function reveal() {
        setVisible(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            if (!drag.current && !focused.current && !hovered.current) setVisible(false);
        }, 1200);
    }

    useEffect(() => {
        const root = document.documentElement;
        let frame = 0;
        function measure() {
            const height = Math.max(0, window.innerHeight - INSET * 2);
            const total = root.scrollHeight;
            const max = Math.max(0, total - window.innerHeight);
            const thumb = Math.min(height, Math.max(MIN_THUMB, height * window.innerHeight / Math.max(1, total)));
            const fraction = max ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            setMetrics({height, thumb, max, top: fraction * (height - thumb), percent: Math.round(fraction * 100)});
        }
        function schedule() {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        }
        function onScroll() {reveal(); schedule();}
        function onPointerMove(event: globalThis.PointerEvent) {
            if (event.pointerType !== "touch" && event.clientX >= window.innerWidth - 16) reveal();
        }
        root.setAttribute("data-page-scrollbar", "");
        measure();
        const observer = new ResizeObserver(schedule);
        observer.observe(root);
        observer.observe(document.body);
        window.addEventListener("scroll", onScroll, {passive: true});
        window.addEventListener("resize", schedule);
        window.addEventListener("pointermove", onPointerMove, {passive: true});
        return () => {
            root.removeAttribute("data-page-scrollbar");
            observer.disconnect();
            cancelAnimationFrame(frame);
            clearTimeout(hideTimer.current);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", schedule);
            window.removeEventListener("pointermove", onPointerMove);
        };
    }, []);

    function scrollTo(top: number) {
        window.scrollTo({top: Math.min(metrics.max, Math.max(0, top)), behavior: "instant"});
        reveal();
    }
    function keyDown(event: KeyboardEvent<HTMLDivElement>) {
        const steps: Record<string, number> = {ArrowDown: 40, ArrowUp: -40, PageDown: window.innerHeight * .9, PageUp: -window.innerHeight * .9};
        if (event.key === "Home") scrollTo(0);
        else if (event.key === "End") scrollTo(metrics.max);
        else if (event.key in steps) scrollTo(window.scrollY + steps[event.key]);
        else return;
        event.preventDefault();
    }
    function pointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.preventDefault();
        const y = event.clientY - INSET;
        if (y < metrics.top || y > metrics.top + metrics.thumb) {
            scrollTo((y - metrics.thumb / 2) / Math.max(1, metrics.height - metrics.thumb) * metrics.max);
        }
        drag.current = {id: event.pointerId, y: event.clientY, scroll: window.scrollY};
        event.currentTarget.setPointerCapture(event.pointerId);
        reveal();
    }
    function pointerMove(event: PointerEvent<HTMLDivElement>) {
        if (drag.current?.id !== event.pointerId) return;
        scrollTo(drag.current.scroll + (event.clientY - drag.current.y) / Math.max(1, metrics.height - metrics.thumb) * metrics.max);
    }
    function finishDrag() {drag.current = null; reveal();}

    if (!metrics.max) return null;
    return <div className="event-page-scrollbar" role="scrollbar" tabIndex={0} aria-label={t("scrollbar.page")}
        aria-controls="main" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.percent}
        data-visible={visible} onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
        onPointerEnter={() => {hovered.current = true; reveal();}} onPointerLeave={() => {hovered.current = false; reveal();}}
        onFocus={() => {focused.current = true; reveal();}} onBlur={() => {focused.current = false; reveal();}}>
        <div className="event-page-scrollbar__thumb" style={{height: metrics.thumb, transform: `translateY(${metrics.top}px)`}} />
    </div>;
}
