import {toast} from "react-hot-toast";
import {isOverloadError} from "@/api/retry";
import {apiErrorText, overloadedMessage} from "@/i18n/apiError";
import {t} from "@/i18n/t";
import {toastErrorWithAction} from "./EventActionToaster";

// The error toast of a failed action: the mapped message (catalog text, the overloaded line, else the
// fallback) and, when the server was only busy and the caller can repeat the same action, «Спробувати ще раз».
export function toastApiError(error: unknown, fallback: string, retry?: () => void): string {
    const message = apiErrorText(error, fallback);
    return retry && isOverloadError(error) ? toastErrorWithAction(message, {label: t("error.overloaded.retry"), onClick: retry}) : toast.error(message);
}

// The error toast of a failed action with its own message: the overloaded line when the server was only
// busy (an overload 503), else the caller's message unchanged.
export function toastFailure(error: unknown, message: string): string {
    return toast.error(overloadedMessage(error) ?? message);
}
