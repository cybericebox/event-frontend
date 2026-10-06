"use client";

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
    const action = draft.Actions[0];
    // Admin's fields are inert when read-only.
    const inert = disabled ? { inert: true } : {};

    return <div className="event-manage-notifications__fields">
        <div className={disabled ? "opacity-60" : undefined} {...inert}>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.notifications.field.title")} help={t("manage.notifications.field.titleHelp")} required />
                <VariableRichText value={draft.Title} onChange={Title => onChange({ ...draft, Title })} variables={variables} placeholder={t("manage.notifications.field.title")} dotted />
            </div>
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.notifications.field.body")} help={t("manage.notifications.field.bodyHelp")} required />
            <InAppBodyEditor value={draft.Body} onChange={Body => onChange({ ...draft, Body })} variables={variables} disabled={disabled} />
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
            <ManageFieldLabel title={t("manage.notifications.field.popIn")} help={t("manage.notifications.field.popInHelp", { min: POP_IN_MIN_SECONDS, max: POP_IN_MAX_SECONDS })} htmlFor="event-inapp-popin" />
            <input className="event-manage-input" id="event-inapp-popin" type="number" min={POP_IN_MIN_SECONDS} max={POP_IN_MAX_SECONDS} step={0.5} disabled={disabled} placeholder={t("manage.notifications.field.popInDefault")}
                value={draft.AutoDismissMs === null ? "" : draft.AutoDismissMs / 1000}
                onChange={event => onChange({ ...draft, AutoDismissMs: event.target.value === "" ? null : Math.round(Number(event.target.value) * 1000) })} />
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.notifications.field.action")} help={t("manage.notifications.field.actionHelp")} />
            {action ? <div className="event-manage-fields-two event-manage-notifications__action">
                <input className="event-manage-input" value={action.label} disabled={disabled} maxLength={60} aria-label={t("manage.notifications.field.actionLabel")} placeholder={t("manage.notifications.field.actionLabel")} onChange={event => onChange({ ...draft, Actions: [{ ...action, label: event.target.value }] })} />
                <input className="event-manage-input" value={action.href} disabled={disabled} aria-label={t("manage.notifications.field.actionHref")} placeholder={t("manage.notifications.field.actionHref")} onChange={event => onChange({ ...draft, Actions: [{ ...action, href: event.target.value }] })} />
                <button className="ib-btn ib-btn--sm" type="button" disabled={disabled} onClick={() => onChange({ ...draft, Actions: [] })}><Trash2 size={15} /> {t("manage.notifications.field.actionRemove")}</button>
            </div> : <div><button className="ib-btn ib-btn--sm" type="button" disabled={disabled} onClick={() => onChange({ ...draft, Actions: [{ label: "", href: "" }] })}><Plus size={15} /> {t("manage.notifications.field.actionAdd")}</button></div>}
        </div>
    </div>;
}
