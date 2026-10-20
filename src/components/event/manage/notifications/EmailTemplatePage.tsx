"use client";

import {useDraftDirty, useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useState} from "react";
import {useDraftRouter as useRouter} from "@/components/event/manage/manualDraft";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Send} from "lucide-react";
import {toast} from "react-hot-toast";
import {failureText, toastFailure} from "@/components/ui/toastApiError";
import {
    customizeManageEmailTemplate, getManageEmailImageURL, getManageEmailPresets, getManageEmailTemplates, publishManageEmailTemplate,
    deleteManageEmailTemplate, resetManageEmailTemplate, rollbackManageEmailTemplate, sendManageEmailTemplateTest, updateManageEmailTemplate,
    uploadManageEmailImage, type ManageEmailTemplate, type ManageEmailTemplateInput,
} from "@/api/manageEmailTemplates";
import {
    channelSignals, getManageNotificationSubscriptions, getManageNotificationTypes, putManageNotificationSubscription,
    reminderDays, signalLabel, REMINDER_SIGNAL,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {useSubscriptionToggle} from "./useSubscriptionToggle";
import {t} from "@/i18n/t";
import {EmailStylingEditor} from "../EmailStylingEditor";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {BlockEditor} from "./editor/BlockEditor";
import {EmailFooterEditor} from "./editor/EmailFooterEditor";
import {VariableRichText} from "./editor/VariableRichText";
import {eventBrandColors} from "./editor/brandColors";
import type {BlockPreset, EmailBodyBlock, PresetBlock} from "./editor/emailBlocks";
import {useManager} from "../ManagerShell";
import {emailRichText} from "../emailBlocks";
import {NotificationPreview} from "./NotificationPreview";
import {orderedVersions, sameValue, templateMode, templateReadOnlyHint, toVariableDefs} from "./notificationModel";
import {ReminderDaysField} from "./ReminderDaysField";
import {TemplateActions} from "./TemplateActions";
import {TemplateHeader} from "./TemplateHeader";
import {TemplateStatusTag} from "./TemplateStatusTag";
import {TemplateVersions} from "./TemplateVersions";
import {useDebounced} from "./useDebounced";
import {NotFoundScreen} from "@/components/event/NotFoundScreen";

const BASE = "/manage/email";

function inputOf(template: ManageEmailTemplate): ManageEmailTemplateInput {
    return {NotificationType: template.NotificationType, Subject: template.Subject, Preheader: template.Preheader, Body: template.Body, Styling: template.Styling};
}

// The page of one email template of the event, laid out like admin's template
// page: header with the actions, versions, the fields on the left and the live
// preview on the right. The platform template is shown read-only until the
// event makes its own copy.
export function EmailTemplatePage({signal, versionID}: {signal: string; versionID?: string}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const presets = useQuery({queryKey: ["event-manage-email-presets", eventID], queryFn: () => getManageEmailPresets(eventID), refetchOnWindowFocus: false});
    const types = useQuery({queryKey: ["event-manage-notification-types", eventID], queryFn: () => getManageNotificationTypes(eventID), refetchOnWindowFocus: false});
    const [drafts, setDrafts] = useSessionDraftState<Record<string, ManageEmailTemplateInput>>(`email-templates-${signal}`, {});
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const href = (id?: string) => `${BASE}/${encodeURIComponent(signal)}${id ? `?id=${id}` : ""}`;

    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "email");
    const subscription = rows.find(item => item.SignalType === signal);
    const versions = orderedVersions(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === versionID) ?? versions[0];
    const mode = templateMode(template);
    const variables = toVariableDefs(types.data?.find(item => item.Type === signal)?.Variables ?? []);
    const brand = eventBrandColors(event);
    const saved = template ? inputOf(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && !sameValue(saved, draft));
    const body = (draft?.Body ?? []) as EmailBodyBlock[];
    const footer = body.find((block): block is PresetBlock => block.type === "preset" && block.placement === "footer");
    const bodyContent = body.filter(block => !(block.type === "preset" && block.placement === "footer"));
    useDraftDirty(`email-templates-${signal}`, Object.entries(drafts).some(([id, value]) => {const original = templates.data?.find(item => item.ID === id); return !original || !sameValue(value, inputOf(original));}));
    const subjectError = !draft?.Subject.trim() ? t("manage.email.validation.subject") : "";
    const bodyError = !draft?.Body.length || !draft.Body.some(block => block.type === "rich_text" && emailRichText(block).trim() || block.type === "button" || block.type === "image" || block.type === "preset") ? t("manage.email.validation.body") : "";
    const buttonError = draft?.Body.some(block => block.type === "button" && (!String(block.label ?? "").trim() || !String(block.url ?? "").trim())) ? t("manage.email.validation.buttons") : "";
    const validation = subjectError || bodyError || buttonError;
    const editable = !!(canManage && mode === "edit");
    const livePreview = useDebounced(draft && !validation ? draft : null);
    const ownVersions = versions.filter(item => item.Source === "event");

    // `inline` takes the error text instead of a toast (an error inside a dialog).
    async function run(action: () => Promise<unknown>, success: string, failure: string, refresh = true, inline?: (text: string) => void): Promise<boolean> {
        if (!canManage || busy) return false;
        setBusy(true);
        try {
            await action();
            if (refresh) await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-manage-email-templates", eventID]}),
            ]);
            toast.success(success);
            return true;
        } catch (caught) {
            if (inline) inline(failureText(caught, failure)); else toastFailure(caught, failure);
            return false;
        } finally {setBusy(false);}
    }

    function mutate(action: () => Promise<ManageEmailTemplate>, success: string, refresh = true) {
        const submitted = template ? drafts[template.ID] : undefined;
        const sourceID = template?.ID;
        return run(async () => {
            const result = await action();
            queryClient.setQueryData<ManageEmailTemplate[]>(["event-manage-email-templates", eventID], current => current?.some(item => item.ID === result.ID) ? current.map(item => item.ID === result.ID ? result : item) : [...(current ?? []), result]);
            setDrafts(current => {if (result.ID === sourceID && current[result.ID] !== submitted) return current; const next = {...current}; delete next[result.ID]; return next;});
            router.replace(href(result.ID));
        }, success, t("manage.email.updateError"), refresh);
    }

    function change(input: ManageEmailTemplateInput) {
        if (template) setDrafts(current => ({...current, [template.ID]: input}));
    }

    async function uploadImage(file: File): Promise<string> {
        if (!template || !editable) throw new Error("not editable");
        return (await uploadManageEmailImage(eventID, template.ID, file)).FileID;
    }

    async function sendTest() {
        if (!template || !canManage || testing) return;
        setTesting(true);
        try {
            const result = await sendManageEmailTemplateTest(eventID, template.ID);
            toast.success(t("manage.email.testSent", {recipient: result.Recipient}));
        } catch (failure) {toastFailure(failure, t("manage.email.testError"));}
        finally {setTesting(false);}
    }

    async function save() {
        if (!editable || !dirty || validation || busy || !template || !draft) return;
        setSaving(true);
        try {await mutate(() => updateManageEmailTemplate(eventID, template.ID, draft), t("manage.email.draftSaved"), false);}
        finally {setSaving(false);}
    }

    const toggleSubscription = useSubscriptionToggle(eventID, canManage, {success: t("manage.email.sendUpdated"), failure: t("manage.email.sendError")});
    const toggle = (enabled: boolean) => {if (subscription) toggleSubscription(subscription.SignalType, subscription.Channel, enabled);};

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label={t("manage.email.loading")} />;
    if (subscriptions.isError || templates.isError) return <EventLoadError message={t("manage.email.loadError")} error={subscriptions.error ?? templates.error} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} />;
    if (!channelSignals(rows, "email").includes(signal)) return <div className="event-manage-settings"><NotFoundScreen block title={t("manage.notifications.templateNotFoundTitle")} body={t("manage.notifications.templateNotFound")} /></div>;

    const label = signalLabel(signal);
    // One orange notice under the header: the untouched platform template, or a read-only copy (published/older version). A draft has none.
    const readOnlyHint = templateReadOnlyHint(mode, canManage);
    return <div className="event-manage-settings event-template-page">
        <TemplateHeader backHref={BASE} backLabel={t("manage.email.title")} title={label.title} tag={<TemplateStatusTag status={mode === "platform" || mode === "none" ? "platform" : template!.Status} />}
            actions={<>
                {subscription && <EventSwitch checked={subscription.Enabled} disabled={!canManage || subscription.Required} ariaLabel={t("manage.notifications.switchHeadLabel")} label={t("manage.notifications.switchShort")} onCheckedChange={toggle} />}
                {canManage && template && <EventButton className="ib-btn" type="button" disabled={testing || busy} busy={testing} busyLabel={t("common.busy.sending")} onClick={() => void sendTest()}><Send size={15} /> {t("manage.email.sendTest")}</EventButton>}
                {editable && <EventButton saveDirty={dirty} busy={saving} busyLabel={t("common.busy.saving")} className="ib-btn ib-btn--primary" type="button" disabled={!!validation || busy} onClick={() => void save()}>{t("manage.notifications.saveDraft")}</EventButton>}
                {editable && !dirty && <button className="ib-btn" type="button" disabled={!!validation || busy} onClick={() => void mutate(() => publishManageEmailTemplate(eventID, template!), t("manage.email.published"))}>{t("manage.notifications.publish")}</button>}
                <TemplateActions mode={mode} canManage={canManage} busy={busy}
                    onCustomize={() => void mutate(() => customizeManageEmailTemplate(eventID, template!), t("manage.notifications.customized"))}
                    onEdit={() => void mutate(() => rollbackManageEmailTemplate(eventID, template!), t("manage.email.draftFromVersion"))}
                    onRestore={() => void mutate(() => rollbackManageEmailTemplate(eventID, template!), t("manage.email.draftFromVersion"))}
                    onDeleteDraft={async () => { let failed = ""; const id = template!.ID; const done = await run(() => deleteManageEmailTemplate(eventID, id), t("manage.notifications.draftDeleted"), t("manage.notifications.deleteDraftError"), true, text => {failed = text;}); if (done) {setDrafts(current => {const next = {...current}; delete next[id]; return next;}); router.replace(href());} return done || failed; }}
                    onReset={async () => { let failed = ""; const done = await run(() => resetManageEmailTemplate(eventID, signal), t("manage.notifications.platformTemplateRestored"), t("manage.email.restoreError"), true, text => {failed = text;}); if (done) router.replace(href()); return done || failed; }} />
            </>} />
        {readOnlyHint && <p className="event-template-page__hint" role="note" data-testid="template-notice">{readOnlyHint}</p>}
        {ownVersions.length > 0 && template && <TemplateVersions versions={ownVersions.map(item => ({ID: item.ID, Status: item.Status, UpdatedAt: item.UpdatedAt, PublishedAt: item.PublishedAt, Heading: item.Subject}))} currentId={template.ID} hrefFor={href}
            canManage={canManage} dirty={dirty} busy={busy} onRestore={id => mutate(() => rollbackManageEmailTemplate(eventID, ownVersions.find(item => item.ID === id)!), t("manage.email.draftFromVersion"))} />}
        {label.description && <p className="event-template-page__intro">{label.description}</p>}
        {subscription && signal === REMINDER_SIGNAL && <ReminderDaysField days={reminderDays(subscription)} disabled={!canManage || busy}
            onCommit={days => void run(() => putManageNotificationSubscription(eventID, {SignalType: subscription.SignalType, Channel: subscription.Channel, Enabled: subscription.Enabled, Audience: subscription.Audience, Config: {days_before_start: days}}), t("manage.notifications.reminder.saved"), t("manage.notifications.reminder.error"))} />}
        {template && draft ? <div className="event-template-grid">
            <div className="event-template-grid__fields">
                <div className={`event-manage-field${editable ? "" : " opacity-60"}`} {...(editable ? {} : {inert: true})}>
                    <ManageFieldLabel title={t("manage.email.subject")} help={t("manage.email.subjectHelp")} required />
                    <VariableRichText key={`subject-${template.ID}`} value={draft.Subject} onChange={Subject => change({...draft, Subject})} variables={variables} placeholder={t("manage.email.subject")} dotted error={editable ? subjectError : ""} />
                </div>
                <div className={`event-manage-field${editable ? "" : " opacity-60"}`} {...(editable ? {} : {inert: true})}>
                    <ManageFieldLabel title={t("manage.email.preheader")} help={t("manage.email.preheaderHelp")} />
                    <VariableRichText key={`preheader-${template.ID}`} value={draft.Preheader} onChange={Preheader => change({...draft, Preheader})} variables={variables} placeholder={t("manage.email.optional")} dotted />
                </div>
                {/* Read-only, the body is the preview on the right: no empty «Текст» field here. */}
                {editable && <div className="event-manage-field" role="group" aria-label={t("manage.tpl.tpl.body")} aria-invalid={editable && !!bodyError || undefined} aria-describedby={editable && bodyError ? `email-body-error-${template.ID}` : undefined}>
                    <ManageFieldLabel title={t("manage.tpl.tpl.body")} help={t("manage.email.blocks.textHelp")} />
                    <BlockEditor key={`body-${template.ID}`} value={bodyContent} onChange={blocks => change({...draft, Body: footer ? [...blocks, footer] : blocks})} variables={variables}
                        presets={(presets.data ?? []) as BlockPreset[]} onUploadImage={uploadImage} imageURL={fileID => getManageEmailImageURL(eventID, fileID)} />
                    {bodyError && <p id={`email-body-error-${template.ID}`} className="event-manage-validation" role="alert">{bodyError}</p>}
                </div>}
                <EmailFooterEditor presetId={footer?.preset_id ?? ""} presets={(presets.data ?? []) as BlockPreset[]} readOnly={!editable}
                    onSelect={id => { const selected = presets.data?.find(preset => preset.ID === id); change({...draft, Body: selected ? [...bodyContent, {type: "preset", preset_id: selected.ID, name: selected.Name, placement: "footer"}] : bodyContent}); }} />
                <EmailStylingEditor styling={draft.Styling} disabled={!editable} brand={brand} onChange={styling => change({...draft, Styling: styling})} />
            </div>
            <div className="event-template-grid__preview">
                <h2>{t("manage.email.previewTitle")}</h2>
                <NotificationPreview email={{event, input: livePreview, valid: !validation}} />
            </div>
        </div> : <EmptyState message={t("manage.email.noTemplate")} />}
    </div>;
}
