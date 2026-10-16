import type {ManageInAppTemplateInput} from "@/api/manageNotifications";
import {t} from "@/i18n/t";
import {POP_IN_MAX_SECONDS, POP_IN_MIN_SECONDS} from "./editor/inAppOptions";

// Only these addresses may open from a button; a variable in it is not allowed.
export function validActionHref(href: string): boolean {
    const value = href.trim();
    // The server accepts an app path or an https address only (no http, mailto or anchors).
    return /^(https:\/\/\S+|\/(?![/\\]).*)$/i.test(value) && !/\s/.test(value) && !value.includes("{{");
}

export function inAppFieldErrors(draft: ManageInAppTemplateInput) {
    return {
        title: !draft.Title.trim() ? t("manage.notifications.validation.title") : "",
        body: !draft.Body.replace(/<[^>]*>/g, "").trim() ? t("manage.notifications.validation.body") : "",
        action: draft.Actions.length > 1 ? t("manage.notifications.validation.actions") : draft.Actions.some(action => !action.label.trim() || !validActionHref(action.href)) ? t("manage.notifications.validation.action") : "",
        popIn: draft.AutoDismissMs !== null && (draft.AutoDismissMs < POP_IN_MIN_SECONDS * 1000 || draft.AutoDismissMs > POP_IN_MAX_SECONDS * 1000) ? t("manage.notifications.validation.popIn", {min: POP_IN_MIN_SECONDS, max: POP_IN_MAX_SECONDS}) : "",
    };
}

// Keep the existing save gate and its first-error order.
export function inAppValidation(draft: ManageInAppTemplateInput): string {
    return Object.values(inAppFieldErrors(draft)).find(Boolean) ?? "";
}
