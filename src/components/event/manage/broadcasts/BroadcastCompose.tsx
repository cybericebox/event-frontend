"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import Link from "next/link";
import {ArrowLeft, Send, TriangleAlert} from "lucide-react";
import {apiErrorMessage, ApiErrorCode} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {countEventBroadcastAudience, sendEventBroadcast, type BroadcastAudience} from "@/api/manageBroadcasts";
import {getManageEmailPresets, type ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";
import {EmptyState} from "@/components/ui/EmptyState";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import {t} from "@/i18n/t";
import {EmailStylingEditor} from "../EmailStylingEditor";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {useManager} from "../ManagerShell";
import {BlockEditor} from "../notifications/editor/BlockEditor";
import {InAppBodyEditor} from "../notifications/editor/InAppBodyEditor";
import {VariableRichText} from "../notifications/editor/VariableRichText";
import {eventBrandColors} from "../notifications/editor/brandColors";
import type {BlockPreset} from "../notifications/editor/emailBlocks";
import {EmailPreview} from "../notifications/EmailPreview";
import {InAppPreview} from "../notifications/InAppPreview";
import {useDebounced} from "../notifications/useDebounced";
import {AudiencePicker} from "./AudiencePicker";
import {TemplateStart} from "./TemplateStart";
import {draftUnsupported, previewDraft, type BroadcastTemplate} from "./broadcastTemplates";
import {
    audienceReady, broadcastPayload, emailBodyFilled, broadcastSampleValues, broadcastVariables, composeValidation, emailPreviewInput, emailValidation,
    emptyDraft, inAppPreviewInput, normalizedAudience, type BroadcastDraft,
} from "./broadcastModel";
import "./broadcasts.css";

const BASE = "/manage/broadcasts";

function sendErrorMessage(error: unknown): string {
    const code = error instanceof ManageApiError ? error.code : undefined;
    if (code === ApiErrorCode.BroadcastEmptyAudience) return t("manage.broadcasts.error.emptyAudience");
    if (code === ApiErrorCode.BroadcastInvalid) return t("manage.broadcasts.error.invalid");
    return apiErrorMessage(code, t("manage.broadcasts.error.send"));
}

// «Надіслати повідомлення»: channels, the message (the email editor of the
// event's templates and the in-app fields), the audience with a live recipient
// count, and the previews. Sending asks for confirmation first.
export function BroadcastCompose() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<BroadcastDraft>(emptyDraft);
    const [confirming, setConfirming] = useState(false);
    // A template chosen over existing content waits here for the replacement to be confirmed.
    const [pendingTemplate, setPendingTemplate] = useState<BroadcastTemplate | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const variables = broadcastVariables();
    const set = (patch: Partial<BroadcastDraft>) => setDraft(current => ({...current, ...patch}));

    const presets = useQuery({queryKey: ["event-manage-email-presets", eventID], queryFn: () => getManageEmailPresets(eventID), enabled: draft.email && canManage, refetchOnWindowFocus: false});
    const currentKey = JSON.stringify(normalizedAudience(draft.Audience));
    const audienceKey = useDebounced(currentKey);
    const audience = useMemo(() => JSON.parse(audienceKey) as BroadcastAudience, [audienceKey]);
    const ready = audienceReady(draft.Audience);
    const count = useQuery({
        queryKey: ["event-broadcast-count", eventID, audienceKey], queryFn: () => countEventBroadcastAudience(eventID, audience),
        enabled: ready && canManage, retry: false, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const settled = audienceKey === currentKey;
    const recipients = ready && settled && !count.isError ? count.data : undefined;
    const validation = composeValidation(draft);
    const canSend = canManage && !validation && recipients !== undefined && recipients > 0 && !count.isFetching;
    const emailInvalid = !!emailValidation(draft);
    const shown = useMemo(() => previewDraft(draft), [draft]);
    const unsupported = useMemo(() => draftUnsupported(draft), [draft]);
    const previewKey = useDebounced(draft.email && !emailInvalid ? JSON.stringify(emailPreviewInput(shown)) : "");
    const livePreview = useMemo(() => previewKey ? JSON.parse(previewKey) as ManageEmailTemplateInput : null, [previewKey]);
    const inAppPreview = inAppPreviewInput(shown);

    function applyTemplate(template: BroadcastTemplate) {
        setDraft(current => ({
            ...current,
            ...(template.email ? {email: true, ...template.email} : {}),
            ...(template.inApp ? {inApp: true, ...template.inApp} : {}),
        }));
    }
    function pickTemplate(template: BroadcastTemplate) {
        const replaces = (template.email && (draft.Subject.trim() !== "" || draft.Preheader.trim() !== "" || emailBodyFilled(draft.Body)))
            || (template.inApp && (draft.InAppTitle.trim() !== "" || draft.InAppBody.trim() !== "" || draft.InAppLink.trim() !== ""));
        if (replaces) setPendingTemplate(template);
        else applyTemplate(template);
    }

    async function send() {
        if (!canSend || sending) return;
        setSending(true);
        setError("");
        try {
            const broadcast = await sendEventBroadcast(eventID, broadcastPayload(draft));
            await queryClient.invalidateQueries({queryKey: ["event-manage-broadcasts", eventID]});
            setConfirming(false);
            router.push(`${BASE}/${broadcast.ID}`);
        } catch (failure) {
            setError(sendErrorMessage(failure));
        } finally {setSending(false);}
    }

    const back = <Link className="event-template-header__back" href={BASE}><ArrowLeft size={15} aria-hidden="true" /> {t("manage.broadcasts.title")}</Link>;
    if (!canManage) return <div className="event-manage-settings">{back}<EmptyState message={t("manage.broadcasts.viewerCannotSend")} /></div>;

    const countText = !ready ? "" : count.isError ? "" : recipients !== undefined && settled ? t("manage.broadcasts.recipients", {count: recipients}) : "";
    return <div className="event-manage-settings event-template-page">
        <div className="event-template-header">
            {back}
            <div className="event-template-header__title"><h1>{t("manage.broadcasts.new")}</h1></div>
            <div className="event-template-header__actions">
                <EventButton className="ib-btn ib-btn--primary" type="button" disabled={!canSend} onClick={() => {setError(""); setConfirming(true);}}><Send size={15} aria-hidden="true" /> {t("manage.broadcasts.send")}</EventButton>
            </div>
        </div>
        <p className="event-template-page__intro">{t("manage.broadcasts.composeIntro")}</p>
        <div className="event-template-grid">
            <div className="event-template-grid__fields">
                <TemplateStart event={event} onPick={pickTemplate} />
                <section className="event-broadcast-section">
                    <ManageFieldLabel title={t("manage.broadcasts.channels")} help={t("manage.broadcasts.channelsHelp")} required />
                    <div className="event-broadcast-channels">
                        <EventCheckbox checked={draft.email} onCheckedChange={email => set({email})} label={t("manage.broadcasts.channel.email")} />
                        <EventCheckbox checked={draft.inApp} onCheckedChange={inApp => set({inApp})} label={t("manage.broadcasts.channel.inApp")} />
                    </div>
                </section>

                {draft.email && <section className="event-broadcast-section" aria-label={t("manage.broadcasts.channel.email")}>
                    <h2>{t("manage.broadcasts.channel.email")}</h2>
                    <div className="event-manage-field">
                        <ManageFieldLabel title={t("manage.email.subject")} help={t("manage.broadcasts.subjectHelp")} required />
                        <VariableRichText value={draft.Subject} onChange={Subject => set({Subject})} variables={variables} placeholder={t("manage.email.subject")} dotted />
                    </div>
                    <div className="event-manage-field">
                        <ManageFieldLabel title={t("manage.email.preheader")} help={t("manage.email.preheaderHelp")} />
                        <VariableRichText value={draft.Preheader} onChange={Preheader => set({Preheader})} variables={variables} placeholder={t("manage.email.optional")} dotted />
                    </div>
                    <div className="event-manage-field">
                        <ManageFieldLabel title={t("manage.tpl.tpl.body")} help={t("manage.email.blocks.textHelp")} required />
                        <BlockEditor value={draft.Body} onChange={Body => set({Body})} variables={variables} presets={(presets.data ?? []) as BlockPreset[]}
                            hiddenBlocks={["image"]} onUploadImage={() => Promise.reject(new Error("images are not supported"))} imageURL={() => ""} />
                    </div>
                    <EmailStylingEditor styling={draft.Styling} disabled={false} brand={eventBrandColors(event)} onChange={Styling => set({Styling})} />
                </section>}

                {draft.inApp && <section className="event-broadcast-section" aria-label={t("manage.broadcasts.channel.inApp")}>
                    <h2>{t("manage.broadcasts.channel.inApp")}</h2>
                    <div className="event-manage-field">
                        <ManageFieldLabel title={t("manage.notifications.field.title")} help={t("manage.notifications.field.titleHelp")} required />
                        <VariableRichText value={draft.InAppTitle} onChange={InAppTitle => set({InAppTitle})} variables={variables} placeholder={t("manage.notifications.field.title")} dotted />
                    </div>
                    <div className="event-manage-field">
                        <ManageFieldLabel title={t("manage.notifications.field.body")} help={t("manage.notifications.field.bodyHelp")} />
                        <InAppBodyEditor value={draft.InAppBody} onChange={InAppBody => set({InAppBody})} variables={variables} />
                    </div>
                    <div className="event-manage-field">
                        <ManageFieldLabel title={t("manage.notifications.field.link")} help={t("manage.notifications.field.linkHelp")} />
                        <VariableRichText value={draft.InAppLink} onChange={InAppLink => set({InAppLink})} variables={variables} placeholder={t("manage.notifications.field.linkPlaceholder")} dotted />
                    </div>
                </section>}

                <section className="event-broadcast-section" aria-label={t("manage.broadcasts.audience.label")}>
                    <AudiencePicker event={event} value={draft.Audience} onChange={Audience => set({Audience})} />
                    <div className="event-broadcast-count" role="status" aria-live="polite">
                        {ready && (count.isFetching || !settled) && <EventBrandLogo event={event} className="event-loading-logo" size={16} />}
                        {countText && <span>{countText}</span>}
                        {ready && count.isError && <span className="event-manage-validation">{t("manage.broadcasts.countError")}</span>}
                    </div>
                </section>
                {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                {recipients === 0 && !validation && ready && <p className="event-manage-validation" role="alert">{t("manage.broadcasts.error.emptyAudience")}</p>}
            </div>
            <div className="event-template-grid__preview event-broadcast-preview">
                {unsupported.length > 0 && <div className="event-manage-warning" role="note">
                    <TriangleAlert size={18} aria-hidden="true" />
                    <ul>{unsupported.map(name => <li key={name}>{t("manage.broadcasts.template.unsupported", {name})}</li>)}</ul>
                </div>}
                {draft.email && <div><h2>{t("manage.broadcasts.previewEmail")}</h2><EmailPreview event={event} input={livePreview} valid={!emailInvalid} /></div>}
                {draft.inApp && <div><h2>{t("manage.broadcasts.previewInApp")}</h2>
                    <InAppPreview template={inAppPreview} values={broadcastSampleValues(event.Name)} /><small>{t("manage.notifications.previewHint")}</small></div>}
                {!draft.email && !draft.inApp && <EmptyState message={t("manage.broadcasts.validation.channels")} />}
            </div>
        </div>
        <ConfirmDialog open={pendingTemplate !== null} onCancel={() => setPendingTemplate(null)} title={t("manage.broadcasts.template.replace.title")}
            description={t("manage.broadcasts.template.replace.body", {name: pendingTemplate?.label ?? ""})} confirmLabel={t("manage.broadcasts.template.replace.action")}
            onConfirm={() => {if (pendingTemplate) applyTemplate(pendingTemplate); setPendingTemplate(null);}} />
        <ConfirmDialog open={confirming} onCancel={() => setConfirming(false)} title={t("manage.broadcasts.confirm.title", {count: recipients ?? 0})}
            description={t("manage.broadcasts.confirm.body")} confirmLabel={t("manage.broadcasts.confirm.action")} busy={sending} error={error || undefined} onConfirm={() => void send()} />
    </div>;
}
