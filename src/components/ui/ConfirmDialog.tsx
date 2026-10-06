"use client";

import {useEffect, useId, useRef, type ReactNode} from "react";
import {t} from "@/i18n/t";
import {EventButton} from "./EventButton";
import "./confirmDialog.css";

// ds-v2 confirm dialog (components/confirm-dialog): a question as the title,
// one or two lines about the consequence, an optional emphasized object name,
// «Скасувати» + the action. tone="danger" makes the action the solid danger
// button. Focus starts on «Скасувати»; Esc and the backdrop cancel unless the
// action is running. Errors stay inside the dialog; the busy action shows the
// event logo, never a spinner.
//
// A native <dialog> in the top layer, so it stacks over DialogModal and over
// Radix dialogs alike. Inside a Radix dialog render it within the dialog's
// content: its Esc is caught first, so the parent stays open.
export function ConfirmDialog({open, onCancel, title, description, subject, confirmLabel, cancelLabel, tone = "default", busy = false, disabled = false, error, onConfirm, children}: {
    open: boolean;
    onCancel: () => void;
    title: string;
    description?: ReactNode;
    subject?: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    busy?: boolean;
    disabled?: boolean;
    error?: ReactNode;
    onConfirm: () => void;
    children?: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const opener = useRef<Element | null>(null);
    const titleID = useId();
    const descriptionID = useId();
    const cancel = () => {if (!busy) onCancel();};

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            opener.current = document.activeElement;
            dialog.showModal();
            cancelRef.current?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
            if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
        }
    }, [open]);

    // Window capture runs before document listeners (Radix closes its dialog
    // on Esc there), so only this dialog reacts.
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (!busy) onCancel();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [open, busy, onCancel]);

    return <dialog ref={ref} className="ib-modal ib-modal--sm event-confirm" role="alertdialog" aria-modal="true"
        aria-labelledby={titleID} aria-describedby={description ? descriptionID : undefined}
        onCancel={event => {event.preventDefault(); cancel();}}
        onClick={event => {
            if (event.target !== ref.current) return;
            const box = ref.current.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) cancel();
        }}>
        {open && <>
            <header className="ib-modal__head"><div>
                <h2 className="ib-modal__title" id={titleID}>{title}</h2>
                {description ? <p className="ib-modal__desc" id={descriptionID}>{description}</p> : null}
            </div></header>
            {(subject || children || error) ? <div className="ib-modal__body">
                {subject ? <p className="event-confirm__subject">{subject}</p> : null}
                {children}
                {error ? <p className="event-confirm__error" role="alert">{error}</p> : null}
            </div> : null}
            <footer className="ib-modal__foot">
                <button ref={cancelRef} className="ib-btn" type="button" disabled={busy} onClick={onCancel}>{cancelLabel ?? t("common.cancel")}</button>
                <EventButton className={`ib-btn ${tone === "danger" ? "ib-btn--danger-solid" : "ib-btn--primary"}`} type="button" busy={busy} disabled={disabled} onClick={onConfirm}>{confirmLabel}</EventButton>
            </footer>
        </>}
    </dialog>;
}
