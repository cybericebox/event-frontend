import type {ManageInAppTemplateInput} from "@/api/manageNotifications";
import {t} from "@/i18n/t";
import {POP_IN_MAX_SECONDS, POP_IN_MIN_SECONDS} from "./editor/inAppOptions";

// Only these addresses may open from a button; a variable in it is not allowed.
export function validActionHref(href: string): boolean {
    const value = href.trim();
    // The server accepts an app path or an https address only (no http, mailto or anchors).
    return /^(https:\/\/\S+|\/(?![/\\]).*)$/i.test(value) && !/\s/.test(value) && !value.includes("{{");
}

// The first reason an in-app draft cannot be saved; empty when it can.
export function inAppValidation(draft: ManageInAppTemplateInput): string {
    if (!draft.Title.trim()) return t("manage.notifications.validation.title");
    if (!draft.Body.replace(/<[^>]*>/g, "").trim()) return t("manage.notifications.validation.body");
    if (draft.Actions.length > 1) return t("manage.notifications.validation.actions");
    if (draft.Actions.some(action => !action.label.trim() || !validActionHref(action.href))) return t("manage.notifications.validation.action");
    if (draft.AutoDismissMs !== null && (draft.AutoDismissMs < POP_IN_MIN_SECONDS * 1000 || draft.AutoDismissMs > POP_IN_MAX_SECONDS * 1000)) return t("manage.notifications.validation.popIn", {min: POP_IN_MIN_SECONDS, max: POP_IN_MAX_SECONDS});
    return "";
}
