"use client";

import {useRef, useState} from "react";
import {Plus, Trash2} from "lucide-react";
import type {ManageInAppTemplateInput, ManageNotificationVariable} from "@/api/manageNotifications";
import {NotificationIcon, notificationAccent} from "@/components/event/NotificationIcon";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {InAppBodyEditor} from "./InAppBodyEditor";
import {IN_APP_ICONS, IN_APP_TONES, POP_IN_MAX_SECONDS, POP_IN_MIN_SECONDS} from "./inAppOptions";
import {insertAtCaret, variableToken} from "./notificationModel";
import {VariableInsert} from "./VariableInsert";

// The full editor of an event's in-app template: the same fields as the admin
// template editor (title, text, link, appearance, pop-in time, button).
export function InAppEditor({draft, disabled, variables, onChange}: {
    draft: ManageInAppTemplateInput; disabled: boolean; variables: ManageNotificationVariable[]; onChange: (draft: ManageInAppTemplateInput) => void;
}) {
    const titleRef = useRef<HTMLInputElement>(null);
    const linkRef = useRef<HTMLInputElement>(null);
    const [moreAppearance, setMoreAppearance] = useState(!!draft.AccentColor);
    const accent = notificationAccent(draft.Tone, draft.AccentColor);

    function insertInto(input: HTMLInputElement | null, field: "Title" | "Link", name: string) {
        const result = insertAtCaret(draft[field], variableToken(name), input?.selectionStart ?? null, input?.selectionEnd ?? null);
        onChange({...draft, [field]: result.value});
        requestAnimationFrame(() => {input?.focus(); input?.setSelectionRange(result.caret, result.caret);});
    }

    const action = draft.Actions[0];

    return <div className="event-manage-notifications__fields">
        <div className="event-manage-field">
            <div className="event-manage-notifications__field-head"><ManageFieldLabel title={t("manage.notifications.field.title")} help={t("manage.notifications.field.titleHelp")} htmlFor="event-inapp-title" required /><VariableInsert variables={variables} disabled={disabled} onInsert={name => insertInto(titleRef.current, "Title", name)} /></div>
            <input ref={titleRef} className="event-manage-input" id="event-inapp-title" value={draft.Title} disabled={disabled} maxLength={200} onChange={event => onChange({...draft, Title: event.target.value})} />
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.notifications.field.body")} help={t("manage.notifications.field.bodyHelp")} htmlFor="event-inapp-body" required />
            <InAppBodyEditor id="event-inapp-body" ariaLabel={t("manage.notifications.field.body")} value={draft.Body} variables={variables} disabled={disabled} onChange={Body => onChange({...draft, Body})} />
        </div>
        <div className="event-manage-field">
            <div className="event-manage-notifications__field-head"><ManageFieldLabel title={t("manage.notifications.field.link")} help={t("manage.notifications.field.linkHelp")} htmlFor="event-inapp-link" /><VariableInsert variables={variables} disabled={disabled} onInsert={name => insertInto(linkRef.current, "Link", name)} /></div>
            <input ref={linkRef} className="event-manage-input" id="event-inapp-link" value={draft.Link} disabled={disabled} onChange={event => onChange({...draft, Link: event.target.value})} placeholder={t("manage.notifications.field.linkPlaceholder")} />
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.notifications.field.appearance")} help={t("manage.notifications.field.appearanceHelp")} />
            <div className="event-manage-notifications__tones" role="radiogroup" aria-label={t("manage.notifications.field.appearance")}>
                {IN_APP_TONES.map(option => <button className="event-manage-notifications__tone" key={option.tone} type="button" role="radio" aria-checked={draft.Tone === option.tone} disabled={disabled}
                    onClick={() => onChange({...draft, Tone: option.tone, Icon: option.icon, AccentColor: ""})}>
                    <NotificationIcon icon={option.icon} tone={option.tone} compact /><span>{t(option.labelKey)}</span>
                </button>)}
            </div>
            <button className="ib-btn ib-btn--sm event-manage-notifications__more" type="button" aria-expanded={moreAppearance} disabled={disabled} onClick={() => setMoreAppearance(open => !open)}>{t("manage.notifications.field.appearanceMore")}</button>
            {moreAppearance && <div className="event-manage-notifications__appearance">
                <div className="event-manage-field">
                    <ManageFieldLabel title={t("manage.notifications.field.icon")} help={t("manage.notifications.field.iconHelp")} />
                    <div className="event-manage-notifications__icons" role="radiogroup" aria-label={t("manage.notifications.field.icon")}>
                        {IN_APP_ICONS.map(option => <button className="event-manage-notifications__icon" key={option.value} type="button" role="radio" aria-checked={draft.Icon === option.value} aria-label={t(option.labelKey)} title={t(option.labelKey)} disabled={disabled}
                            onClick={() => onChange({...draft, Icon: option.value})}><NotificationIcon icon={option.value} tone={draft.Tone} accentColor={draft.AccentColor} compact /></button>)}
                    </div>
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel title={t("manage.notifications.field.accent")} help={t("manage.notifications.field.accentHelp")} htmlFor="event-inapp-accent" />
                    <div className="event-manage-notifications__accent">
                        <input id="event-inapp-accent" type="color" value={accent.length === 7 ? accent : "#64748B"} disabled={disabled} onChange={event => onChange({...draft, AccentColor: event.target.value.toUpperCase()})} />
                        <span>{draft.AccentColor ? draft.AccentColor : t("manage.notifications.field.accentAuto")}</span>
                        {draft.AccentColor && <button className="ib-btn ib-btn--sm" type="button" disabled={disabled} onClick={() => onChange({...draft, AccentColor: ""})}>{t("manage.notifications.field.accentClear")}</button>}
                    </div>
                </div>
            </div>}
        </div>
        <div className="event-manage-field event-manage-notifications__narrow">
            <ManageFieldLabel title={t("manage.notifications.field.popIn")} help={t("manage.notifications.field.popInHelp")} htmlFor="event-inapp-popin" />
            <input className="event-manage-input" id="event-inapp-popin" type="number" min={POP_IN_MIN_SECONDS} max={POP_IN_MAX_SECONDS} step={0.5} disabled={disabled} placeholder={t("manage.notifications.field.popInDefault")}
                value={draft.AutoDismissMs === null ? "" : draft.AutoDismissMs / 1000}
                onChange={event => onChange({...draft, AutoDismissMs: event.target.value === "" ? null : Math.round(Number(event.target.value) * 1000)})} />
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.notifications.field.action")} help={t("manage.notifications.field.actionHelp")} />
            {action ? <div className="event-manage-fields-two event-manage-notifications__action">
                <input className="event-manage-input" value={action.label} disabled={disabled} maxLength={60} aria-label={t("manage.notifications.field.actionLabel")} placeholder={t("manage.notifications.field.actionLabel")} onChange={event => onChange({...draft, Actions: [{...action, label: event.target.value}]})} />
                <input className="event-manage-input" value={action.href} disabled={disabled} aria-label={t("manage.notifications.field.actionHref")} placeholder={t("manage.notifications.field.actionHref")} onChange={event => onChange({...draft, Actions: [{...action, href: event.target.value}]})} />
                <button className="ib-btn ib-btn--sm" type="button" disabled={disabled} onClick={() => onChange({...draft, Actions: []})}><Trash2 size={15} /> {t("manage.notifications.field.actionRemove")}</button>
            </div> : <div><button className="ib-btn ib-btn--sm" type="button" disabled={disabled} onClick={() => onChange({...draft, Actions: [{label: "", href: ""}]})}><Plus size={15} /> {t("manage.notifications.field.actionAdd")}</button></div>}
        </div>
    </div>;
}
