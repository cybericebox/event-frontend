"use client";

import {isValidElement, useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {CheckCircle2, CircleAlert, TriangleAlert, X} from "lucide-react";
import toast, {Toaster, resolveValue, type Toast} from "react-hot-toast";
import {t} from "@/i18n/t";

export type ToastAction = {label: string; onClick: () => void};

// The message of a toast with one action button; react-hot-toast carries only the message, so the action rides in its props.
function ActionMessage({text}: {text: string; action: ToastAction}) {
    return text;
}

// An error toast with an action (e.g. «Спробувати ще раз»): the click closes the toast and runs the action.
export function toastErrorWithAction(text: string, action: ToastAction): string {
    return toast.error(<ActionMessage text={text} action={action} />);
}

function ActionToast({item}: {item: Toast}) {
    const tone = item.type === "success" ? "success" : item.type === "error" ? "error" : "warning";
    const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? CircleAlert : TriangleAlert;
    const withAction = isValidElement<{text: string; action: ToastAction}>(item.message) && item.message.type === ActionMessage ? item.message.props : null;
    const text = withAction ? withAction.text : typeof item.message === "string" ? item.message : null;
    const label = text !== null ? t("notifications.closeNamed", {message: text}) : t("notifications.close");

    return <div className="event-action-toast" data-tone={tone} data-visible={item.visible} role={tone === "success" ? "status" : "alert"} aria-live={tone === "success" ? "polite" : "assertive"}>
        <Icon className="event-action-toast__icon" aria-hidden="true" />
        <span className="event-action-toast__message">{withAction ? withAction.text : resolveValue(item.message, item)}</span>
        {withAction && <button className="event-action-toast__action" type="button" onClick={() => { toast.dismiss(item.id); withAction.action.onClick(); }}>{withAction.action.label}</button>}
        <button className="event-action-toast__close" type="button" aria-label={label} onClick={() => toast.dismiss(item.id)}><X size={16} aria-hidden="true" /></button>
    </div>;
}

function isModal(dialog: HTMLDialogElement): boolean {
    try {
        return dialog.matches(":modal");
    } catch {
        // No :modal support (old engines, jsdom): an open dialog is treated as modal.
        return true;
    }
}

// The modal <dialog> opened last, or null. A modal dialog sits in the top layer and makes the rest of the page
// inert, so a toast outside it would be hidden under it and could not be closed.
export function useTopModalDialog(): HTMLDialogElement | null {
    const [top, setTop] = useState<HTMLDialogElement | null>(null);
    useEffect(() => {
        const stack: HTMLDialogElement[] = [];
        const update = () => {
            const open = Array.from(document.querySelectorAll("dialog")).filter(dialog => dialog.open && isModal(dialog));
            for (let index = stack.length - 1; index >= 0; index--) if (!open.includes(stack[index])) stack.splice(index, 1);
            for (const dialog of open) if (!stack.includes(dialog)) stack.push(dialog);
            setTop(stack.at(-1) ?? null);
        };
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["open"]});
        return () => observer.disconnect();
    }, []);
    return top;
}

// While a modal dialog is open the toasts render inside it (the top layer), so they stay visible and closable.
export function EventActionToaster() {
    const dialog = useTopModalDialog();
    const toaster = <Toaster position="top-center" gutter={8} containerStyle={{top: 16, zIndex: 100}} toastOptions={{duration: 5000}}>{item => <ActionToast item={item} />}</Toaster>;
    return dialog ? createPortal(toaster, dialog) : toaster;
}
