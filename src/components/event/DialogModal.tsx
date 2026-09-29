"use client";

import {useEffect, useId, useRef, type ReactNode} from "react";
import {X} from "lucide-react";

// ds-v2 modal (components/modal) on a native <dialog>: it lands in the top
// layer, so it stacks correctly over the challenge window. Esc and a click on
// the backdrop close it; focus returns to the opener.
export function DialogModal({open, onClose, title, description, size = "sm", footer, children}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: ReactNode;
    size?: "sm" | "md";
    footer?: ReactNode;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleID = useId();
    const opener = useRef<Element | null>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            opener.current = document.activeElement;
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);
    return <dialog ref={ref} className={`ib-modal event-dialog${size === "sm" ? " ib-modal--sm" : ""}`} aria-labelledby={titleID}
        onClose={() => { onClose(); if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus(); }}
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => {
            if (event.target !== ref.current) return;
            const box = ref.current.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
        }}>
        {open && <>
            <header className="ib-modal__head">
                <div><h2 className="ib-modal__title" id={titleID}>{title}</h2>{description && <p className="ib-modal__desc">{description}</p>}</div>
                <button className="ib-icon-btn ib-icon-btn--sm ib-modal__close" type="button" aria-label="Закрити" onClick={onClose}><X aria-hidden="true" /></button>
            </header>
            <div className="ib-modal__body">{children}</div>
            {footer && <footer className="ib-modal__foot">{footer}</footer>}
        </>}
    </dialog>;
}
