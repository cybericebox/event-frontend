"use client";

import {useMemo, type FocusEvent} from "react";
import {useQuery} from "@tanstack/react-query";
import {TriangleAlert} from "lucide-react";
import {getManageEmailPresets, type ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {t} from "@/i18n/t";
import {EmailStylingEditor} from "../EmailStylingEditor";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {BlockEditor} from "../notifications/editor/BlockEditor";
import {InAppBodyEditor} from "../notifications/editor/InAppBodyEditor";
import {VariableRichText} from "../notifications/editor/VariableRichText";
import {eventBrandColors} from "../notifications/editor/brandColors";
import type {BlockPreset} from "../notifications/editor/emailBlocks";
import {NotificationPreview} from "../notifications/NotificationPreview";
import {useDebounced} from "../notifications/useDebounced";
import {draftUnsupported, previewDraft} from "./broadcastTemplates";
import {broadcastSampleValues, broadcastVariables, emailBodyFilled, emailPreviewInput, emailValidation, inAppPreviewInput, type BroadcastMessage} from "./broadcastModel";

// Which field errors are shown: a field shows its error once it was left or after the form was submitted.
export type FieldVisibility = {
    visible: (field: string) => boolean;
    leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
};

// The message of a broadcast: channels, the email part (the event templates' email editor) and the in-app part.
// Shared by the composer and the broadcast template editor, so a template holds exactly what a broadcast sends.
export function BroadcastMessageFields({event, value, onChange, fields, idPrefix, canLoadPresets}: {
    event: PublicEventInfo;
    value: BroadcastMessage;
    onChange: (patch: Partial<BroadcastMessage>) => void;
    fields: FieldVisibility;
    idPrefix: string;
    canLoadPresets: boolean;
}) {
    const eventID = event.EventID;
    const variables = broadcastVariables();
    const {visible, leave} = fields;
    const presets = useQuery({queryKey: ["event-manage-email-presets", eventID], queryFn: () => getManageEmailPresets(eventID), enabled: value.email && canLoadPresets, refetchOnWindowFocus: false});
    const subjectError = visible("subject") && !value.Subject.trim() ? t("manage.broadcasts.validation.subject") : "";
    const bodyError = visible("body") && !emailBodyFilled(value.Body) ? t("manage.broadcasts.validation.body") : "";
    const titleError = visible("title") && !value.InAppTitle.trim() ? t("manage.broadcasts.validation.inAppTitle") : "";
    const bodyErrorID = `${idPrefix}-body-error`;

    return <>
        <section className="event-broadcast-section">
            <ManageFieldLabel title={t("manage.broadcasts.channels")} help={t("manage.broadcasts.channelsHelp")} required />
            <div className="event-broadcast-channels">
                <EventCheckbox checked={value.email} onCheckedChange={email => onChange({email})} label={t("manage.broadcasts.channel.email")} />
                <EventCheckbox checked={value.inApp} onCheckedChange={inApp => onChange({inApp})} label={t("manage.broadcasts.channel.inApp")} />
            </div>
            {!value.email && !value.inApp && <p className="event-manage-validation" role="alert">{t("manage.broadcasts.validation.channels")}</p>}
        </section>

        {value.email && <section className="event-broadcast-section" aria-label={t("manage.broadcasts.channel.email")}>
            <h2>{t("manage.broadcasts.channel.email")}</h2>
            <div className="event-manage-field" onBlur={leave("subject")}>
                <ManageFieldLabel title={t("manage.email.subject")} help={t("manage.broadcasts.subjectHelp")} required />
                <VariableRichText value={value.Subject} onChange={Subject => onChange({Subject})} variables={variables} placeholder={t("manage.email.subject")} dotted error={subjectError} />
            </div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.email.preheader")} help={t("manage.email.preheaderHelp")} />
                <VariableRichText value={value.Preheader} onChange={Preheader => onChange({Preheader})} variables={variables} placeholder={t("manage.email.optional")} dotted />
            </div>
            <div className="event-manage-field" role="group" onBlur={leave("body")} aria-label={t("manage.tpl.tpl.body")} aria-invalid={!!bodyError || undefined} aria-describedby={bodyError ? bodyErrorID : undefined}>
                <ManageFieldLabel title={t("manage.tpl.tpl.body")} help={t("manage.email.blocks.textHelp")} required />
                <BlockEditor value={value.Body} onChange={Body => onChange({Body})} variables={variables} presets={(presets.data ?? []) as BlockPreset[]}
                    hiddenBlocks={["image"]} onUploadImage={() => Promise.reject(new Error("images are not supported"))} imageURL={() => ""} />
                {bodyError && <p id={bodyErrorID} className="event-manage-validation" role="alert">{bodyError}</p>}
            </div>
            <EmailStylingEditor styling={value.Styling} disabled={false} brand={eventBrandColors(event)} onChange={Styling => onChange({Styling})} />
        </section>}

        {value.inApp && <section className="event-broadcast-section" aria-label={t("manage.broadcasts.channel.inApp")}>
            <h2>{t("manage.broadcasts.channel.inApp")}</h2>
            <div className="event-manage-field" onBlur={leave("title")}>
                <ManageFieldLabel title={t("manage.notifications.field.title")} help={t("manage.notifications.field.titleHelp")} required />
                <VariableRichText value={value.InAppTitle} onChange={InAppTitle => onChange({InAppTitle})} variables={variables} placeholder={t("manage.notifications.field.title")} dotted error={titleError} />
            </div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.notifications.field.body")} help={t("manage.notifications.field.bodyHelp")} />
                <InAppBodyEditor value={value.InAppBody} onChange={InAppBody => onChange({InAppBody})} variables={variables} />
            </div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.notifications.field.link")} help={t("manage.notifications.field.linkHelp")} />
                <VariableRichText value={value.InAppLink} onChange={InAppLink => onChange({InAppLink})} variables={variables} placeholder={t("manage.notifications.field.linkPlaceholder")} dotted />
            </div>
        </section>}
    </>;
}

// The previews of the message as recipients get it (unsupported variables empty), with the warning about them.
export function BroadcastMessagePreview({event, value}: {event: PublicEventInfo; value: BroadcastMessage}) {
    const emailInvalid = !!emailValidation(value);
    const shown = useMemo(() => previewDraft(value), [value]);
    const unsupported = useMemo(() => draftUnsupported(value), [value]);
    const previewKey = useDebounced(value.email && !emailInvalid ? JSON.stringify(emailPreviewInput(shown)) : "");
    const livePreview = useMemo(() => previewKey ? JSON.parse(previewKey) as ManageEmailTemplateInput : null, [previewKey]);
    return <>
        {unsupported.length > 0 && <div className="event-manage-warning" role="note">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>{t("manage.broadcasts.template.unsupportedNames", {names: unsupported.join(", ")})}</span>
        </div>}
        <NotificationPreview email={value.email ? {event, input: livePreview, valid: !emailInvalid} : undefined}
            inApp={value.inApp ? {template: inAppPreviewInput(shown), values: broadcastSampleValues(event.Name)} : undefined} />
        {!value.email && !value.inApp && <EmptyState message={t("manage.broadcasts.validation.channels")} />}
    </>;
}
