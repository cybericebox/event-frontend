"use client";

import {CheckCircle2, CircleAlert, TriangleAlert, X} from "lucide-react";
import toast, {Toaster, resolveValue, type Toast} from "react-hot-toast";
import {t} from "@/i18n/t";

function ActionToast({item}: {item: Toast}) {
    const tone = item.type === "success" ? "success" : item.type === "error" ? "error" : "warning";
    const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? CircleAlert : TriangleAlert;
    const label = typeof item.message === "string" ? t("notifications.closeNamed", {message: item.message}) : t("notifications.close");

    return <div className="event-action-toast" data-tone={tone} data-visible={item.visible} role={tone === "success" ? "status" : "alert"} aria-live={tone === "success" ? "polite" : "assertive"}>
        <Icon className="event-action-toast__icon" aria-hidden="true" />
        <span className="event-action-toast__message">{resolveValue(item.message, item)}</span>
        <button className="event-action-toast__close" type="button" aria-label={label} onClick={() => toast.dismiss(item.id)}><X size={16} aria-hidden="true" /></button>
    </div>;
}

export function EventActionToaster() {
    return <Toaster position="top-center" gutter={8} containerStyle={{top: 16, zIndex: 100}} toastOptions={{duration: 5000}}>{item => <ActionToast item={item} />}</Toaster>;
}
