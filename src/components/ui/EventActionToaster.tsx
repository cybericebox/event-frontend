"use client";

import {isValidElement} from "react";
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

export function EventActionToaster() {
    return <Toaster position="top-center" gutter={8} containerStyle={{top: 16, zIndex: 100}} toastOptions={{duration: 5000}}>{item => <ActionToast item={item} />}</Toaster>;
}
