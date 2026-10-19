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

// A modal layer: a native modal <dialog> (top layer, the rest of the page inert) or the content of a Radix modal
// dialog marked with data-event-modal (fixed over a z-index 1100 backdrop, the rest of the page aria-hidden, a tap
// outside closes it). A toast outside such a layer is hidden under it, cannot be closed, or closes the dialog.
const MODAL_LAYER = 'dialog[open], [data-event-modal][data-state="open"]';

function isModalLayer(element: Element): boolean {
    if (!(element instanceof HTMLDialogElement)) return true;
    try {
        return element.matches(":modal");
    } catch {
        // No :modal support (old engines): an open dialog is treated as modal.
        return true;
    }
}

// Only mutations that can open or close a modal layer are worth a look.
function touchesModalLayer(record: MutationRecord): boolean {
    if (record.type === "attributes") return record.target instanceof Element && (record.target.localName === "dialog" || record.target.hasAttribute("data-event-modal"));
    return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && (node.matches("dialog, [data-event-modal]") || !!node.querySelector("dialog, [data-event-modal]")));
}

// The modal layer opened last, or null.
export function useTopModalLayer(): HTMLElement | null {
    const [top, setTop] = useState<HTMLElement | null>(null);
    useEffect(() => {
        const stack: HTMLElement[] = [];
        const update = () => {
            const open = Array.from(document.querySelectorAll<HTMLElement>(MODAL_LAYER)).filter(isModalLayer);
            for (let index = stack.length - 1; index >= 0; index--) if (!open.includes(stack[index])) stack.splice(index, 1);
            for (const layer of open) if (!stack.includes(layer)) stack.push(layer);
            setTop(stack.at(-1) ?? null);
        };
        update();
        const observer = new MutationObserver(records => {if (records.some(touchesModalLayer)) update();});
        observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["open", "data-state"]});
        return () => observer.disconnect();
    }, []);
    return top;
}

// One toast layer for the whole site: inside the modal layer opened last (a native <dialog> or a Radix modal), else
// in the page. So a toast is always above every modal, visible and closable, and closing it never closes the dialog.
export function EventActionToaster() {
    const dialog = useTopModalLayer();
    const toaster = <Toaster position="top-center" gutter={8} containerStyle={{top: 16, zIndex: 100}} toastOptions={{duration: 5000}}>{item => <ActionToast item={item} />}</Toaster>;
    return dialog ? createPortal(toaster, dialog) : toaster;
}
