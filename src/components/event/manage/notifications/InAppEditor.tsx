"use client";

import {useId} from "react";
import {inAppFieldErrors} from "./inAppValidation";
import { Plus, Trash2 } from "lucide-react";
import type { ManageInAppTemplateInput } from "@/api/manageNotifications";
import { t } from "@/i18n/t";
import { ManageFieldLabel } from "../ManageFieldLabel";
import { InAppBodyEditor } from "./editor/InAppBodyEditor";
import { NotificationAppearancePicker } from "./editor/NotificationAppearancePicker";
import { VariableRichText } from "./editor/VariableRichText";
import { POP_IN_MAX_SECONDS, POP_IN_MIN_SECONDS } from "./editor/inAppOptions";
import type { VariableDef } from "./editor/variableUtils";

// The full editor of an event's in-app template: the fields of the admin
// template editor (title, text, link, appearance, pop-in time, button).
export function InAppEditor({ draft, disabled, variables, onChange }: {
    draft: ManageInAppTemplateInput; disabled: boolean; variables: VariableDef[]; onChange: (draft: ManageInAppTemplateInput) => void;
}) {
    const id = useId();
    const errors = disabled ? {title: "", body: "", action: "", popIn: ""} : inAppFieldErrors(draft);
    const action = draft.Actions[0];
    // Admin's fields are inert when read-only.
    const inert = disabled ? { inert: true } : {};

    return <div className="event-manage-notifications__fields">
        <div className={disabled ? "opacity-60" : undefined} {...inert}>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.notifications.field.title")} help={t("manage.notifications.field.titleHelp")} required />
                <VariableRichText value={draft.Title} onChange={Title => onChange({ ...draft, Title })} variables={variables} placeholder={t("manage.notifications.field.title")} dotted error={errors.title} />
            </div>
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.notifications.field.body")} help={t("manage.notifications.field.bodyHelp")} required />
            <InAppBodyEditor value={draft.Body} onChange={Body => onChange({ ...draft, Body })} variables={variables} disabled={disabled} error={errors.body} />
        </div>
        <div className={disabled ? "opacity-60" : undefined} {...inert}>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.notifications.field.link")} help={t("manage.notifications.field.linkHelp")} />
                <VariableRichText value={draft.Link} onChange={Link => onChange({ ...draft, Link })} variables={variables} placeholder={t("manage.notifications.field.linkPlaceholder")} dotted />
            </div>
        </div>
        <NotificationAppearancePicker icon={draft.Icon} tone={draft.Tone} accentColor={draft.AccentColor} disabled={disabled}
            onChange={next => onChange({ ...draft, Icon: next.icon, Tone: next.tone, AccentColor: next.accentColor })} />
        <div className="event-manage-field event-manage-notifications__narrow">
            <ManageFieldLabel title={t("manage.notifications.field.popIn")} help={t("manage.notifications.field.popInHelp", { min: POP_IN_MIN_SECONDS, max: POP_IN_MAX_SECONDS })} htmlFor={`${id}-popin`} />
            <input className="event-manage-input" id={`${id}-popin`} aria-invalid={!!errors.popIn || undefined} aria-describedby={errors.popIn ? `${id}-popin-error` : undefined} type="number" min={POP_IN_MIN_SECONDS} max={POP_IN_MAX_SECONDS} step={0.5} disabled={disabled} placeholder={t("manage.notifications.field.popInDefault")}
                value={draft.AutoDismissMs === null ? "" : draft.AutoDismissMs / 1000}
                onChange={event => onChange({ ...draft, AutoDismissMs: event.target.value === "" ? null : Math.round(Number(event.target.value) * 1000) })} />
            {errors.popIn && <p id={`${id}-popin-error`} className="event-manage-validation" role="alert">{errors.popIn}</p>}
        </div>
        <div className="event-manage-field" role="group" aria-label={t("manage.notifications.field.action")} aria-invalid={!!errors.action || undefined} aria-describedby={errors.action ? `${id}-action-error` : undefined}>
            <ManageFieldLabel title={t("manage.notifications.field.action")} help={t("manage.notifications.field.actionHelp")} />
            {action ? <div className="event-manage-fields-two event-manage-notifications__action">
                <input className="event-manage-input" value={action.label} aria-invalid={!!errors.action || undefined} aria-describedby={errors.action ? `${id}-action-error` : undefined} disabled={disabled} maxLength={60} aria-label={t("manage.notifications.field.actionLabel")} placeholder={t("manage.notifications.field.actionLabel")} onChange={event => onChange({ ...draft, Actions: [{ ...action, label: event.target.value }] })} />
                <input className="event-manage-input" value={action.href} aria-invalid={!!errors.action || undefined} aria-describedby={errors.action ? `${id}-action-error` : undefined} disabled={disabled} aria-label={t("manage.notifications.field.actionHref")} placeholder={t("manage.notifications.field.actionHref")} onChange={event => onChange({ ...draft, Actions: [{ ...action, href: event.target.value }] })} />
                <button className="ib-btn ib-btn--sm" type="button" disabled={disabled} onClick={() => onChange({ ...draft, Actions: [] })}><Trash2 size={15} /> {t("manage.notifications.field.actionRemove")}</button>
            </div> : <div><button className="ib-btn ib-btn--sm" type="button" disabled={disabled} onClick={() => onChange({ ...draft, Actions: [{ label: "", href: "" }] })}><Plus size={15} /> {t("manage.notifications.field.actionAdd")}</button></div>}
            {errors.action && <p id={`${id}-action-error`} className="event-manage-validation" role="alert">{errors.action}</p>}
        </div>
    </div>;
}
