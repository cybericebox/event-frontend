"use client";

import {useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Send} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    createManageEmailTemplate, customizeManageEmailTemplate, getManageEmailTemplates,
    getManageEmailImageURL, uploadManageEmailImage,
    publishManageEmailTemplate, resetManageEmailTemplate,
    rollbackManageEmailTemplate, sendManageEmailTemplateTest, updateManageEmailTemplate,
    type ManageEmailTemplate, type ManageEmailTemplateInput,
} from "@/api/manageEmailTemplates";
import {
    getManageNotificationSubscriptions, getManageNotificationTypes, putManageNotificationSubscription,
    resetManageNotificationSubscription, channelSignals, reminderDays, signalLabel, REMINDER_SIGNAL,
    type ManageNotificationSubscription,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmailBlocksEditor} from "@/components/event/manage/EmailBlocksEditor";
import {EmailStylingEditor} from "@/components/event/manage/EmailStylingEditor";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {emailRichText, emailRichTextBlock} from "@/components/event/manage/emailBlocks";
import {EmailPreview} from "@/components/event/manage/notifications/EmailPreview";
import {insertAtCaret, orderedVersions, templateMode, variableToken} from "@/components/event/manage/notifications/notificationModel";
import {ReminderDaysField} from "@/components/event/manage/notifications/ReminderDaysField";
import {SignalHead, SignalList} from "@/components/event/manage/notifications/SignalList";
import {TemplateActions} from "@/components/event/manage/notifications/TemplateActions";
import {VariableInsert} from "@/components/event/manage/notifications/VariableInsert";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";

const statusLabel = (status: ManageEmailTemplate["Status"]) => t(`manage.notifications.status.${status}`);

function inputOf(template: ManageEmailTemplate): ManageEmailTemplateInput {
    return {NotificationType: template.NotificationType, Subject: template.Subject, Preheader: template.Preheader, Body: template.Body, Styling: template.Styling};
}

function subscriptionBody(row: ManageNotificationSubscription, patch: {Enabled?: boolean; Config?: Record<string, unknown>}) {
    return {SignalType: row.SignalType, Channel: row.Channel, Enabled: patch.Enabled ?? row.Enabled, Audience: row.Audience, ...(patch.Config ? {Config: patch.Config} : {})};
}

export default function ManageEmailPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const types = useQuery({queryKey: ["event-manage-notification-types", eventID], queryFn: () => getManageNotificationTypes(eventID), refetchOnWindowFocus: false});
    const [selectedSignal, setSignal] = useState("");
    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "email");
    const signals = channelSignals(rows, "email");
    const signal = signals.includes(selectedSignal) ? selectedSignal : signals[0] ?? "";
    const label = signalLabel(signal);
    const [testResult, setTestResult] = useState<{templateID: string; message: string} | null>(null);
    const [testing, setTesting] = useState(false);
    const [selectedTemplateID, setSelectedTemplateID] = useState("");
    const [drafts, setDrafts] = useState<Record<string, ManageEmailTemplateInput>>({});
    const [previewDraft, setPreviewDraft] = useState<{templateID: string; input: ManageEmailTemplateInput} | null>(null);
    const [busy, setBusy] = useState(false);
    const subjectRef = useRef<HTMLInputElement>(null);
    const preheaderRef = useRef<HTMLInputElement>(null);
    const versions = orderedVersions(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === selectedTemplateID) ?? versions[0];
    const mode = templateMode(template);
    const subscription = rows.find(item => item.SignalType === signal);
    const variables = types.data?.find(item => item.Type === signal)?.Variables ?? [];
    const saved = template ? inputOf(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
    const validation = !draft?.Subject.trim() ? t("manage.email.validation.subject")
        : !draft.Body.length || !draft.Body.some(block => block.type === "rich_text" && emailRichText(block).trim() || block.type === "button" || block.type === "image" || block.type === "preset") ? t("manage.email.validation.body")
        : draft.Body.some(block => block.type === "button" && (!String(block.label ?? "").trim() || !String(block.url ?? "").trim())) ? t("manage.email.validation.buttons")
        : "";
    const valid = !validation;
    const editable = !!(canManage && mode === "edit" && !busy);
    // The editor shows the last refreshed draft; a read-only view shows the saved version.
    const previewInput = template && draft ? mode === "edit" && previewDraft?.templateID === template.ID ? previewDraft.input : saved : null;
    const previewStale = !!(mode === "edit" && dirty && (!previewDraft || previewDraft.templateID !== template?.ID || JSON.stringify(previewDraft.input) !== JSON.stringify(draft)));

    function change(input: ManageEmailTemplateInput) {
        if (!template) return;
        setDrafts(current => ({...current, [template.ID]: input}));
    }

    function insertInto(field: "Subject" | "Preheader", input: HTMLInputElement | null, name: string) {
        if (!draft) return;
        const result = insertAtCaret(draft[field], variableToken(name), input?.selectionStart ?? null, input?.selectionEnd ?? null);
        change({...draft, [field]: result.value});
        requestAnimationFrame(() => {input?.focus(); input?.setSelectionRange(result.caret, result.caret);});
    }

    async function addImage(file: File) {
        if (!template || !editable) return;
        const target = template;
        setBusy(true);
        try {
            const uploaded = await uploadManageEmailImage(eventID, target.ID, file);
            setDrafts(current => {
                const input = current[target.ID] ?? inputOf(target);
                return {...current, [target.ID]: {...input, Body: [...input.Body, {type: "image", file_id: uploaded.FileID, alt: file.name.replace(/\.[^.]+$/, ""), width_pct: 100}]}};
            });
            toast.success(t("manage.email.imageAdded"));
        } catch {toast.error(t("manage.email.imageError"));}
        finally {setBusy(false);}
    }

    async function run(action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> {
        if (!canManage || busy) return false;
        setBusy(true);
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-manage-email-templates", eventID]}),
            ]);
            toast.success(success);
            return true;
        } catch {
            toast.error(failure);
            return false;
        } finally {setBusy(false);}
    }

    async function sendTest(target: ManageEmailTemplate) {
        if (!canManage || testing) return;
        setTesting(true);
        try {
            const result = await sendManageEmailTemplateTest(eventID, target.ID);
            setTestResult({templateID: target.ID, message: t("manage.email.testSent", {recipient: result.Recipient})});
        } catch {toast.error(t("manage.email.testError"));}
        finally {setTesting(false);}
    }

    async function mutateTemplate(action: () => Promise<ManageEmailTemplate>, success: string) {
        return run(async () => {
            const result = await action();
            setSelectedTemplateID(result.ID);
            setPreviewDraft(null);
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
        }, success, t("manage.email.updateError"));
    }

    function toggle(target: string, enabled: boolean) {
        const row = rows.find(item => item.SignalType === target);
        if (row) void run(() => putManageNotificationSubscription(eventID, subscriptionBody(row, {Enabled: enabled})), t("manage.email.sendUpdated"), t("manage.email.sendError"));
    }

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label={t("manage.email.loading")} />;
    if (subscriptions.isError || templates.isError) return <EventLoadError message={t("manage.email.loadError")} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} />;
    if (!signals.length) return <div className="event-manage-content event-manage-notifications event-manage-email"><header className="event-manage-heading"><div><h1>{t("manage.email.title")}</h1></div></header><section className="event-manage-section"><EmptyState message={t("manage.email.none")} /></section></div>;

    return <div className="event-manage-content event-manage-notifications event-manage-email">
        <header className="event-manage-heading"><div><h1>{t("manage.email.title")}</h1><p>{t("manage.email.intro")}</p></div></header>
        <div className="event-manage-notifications__layout">
            <SignalList signals={signals} rows={rows} selected={signal} canManage={canManage} busy={busy} ariaLabel={t("manage.email.listLabel")}
                onSelect={next => {setSignal(next); setSelectedTemplateID(""); setPreviewDraft(null);}} onToggle={toggle} />
            <div className="event-manage-notifications__main">
                <section className="event-manage-section">
                    <SignalHead signal={signal} row={subscription} canManage={canManage} busy={busy} help={t("manage.email.sendHelp")} requiredHelp={t("manage.email.sendRequiredHelp")}
                        onToggle={enabled => toggle(signal, enabled)}
                        onReset={() => void run(() => resetManageNotificationSubscription(eventID, signal, "email"), t("manage.notifications.settingReset"), t("manage.notifications.settingResetError"))} />
                    {!subscription && <EmptyState compact message={t("manage.email.noSetting")} />}
                    {subscription && signal === REMINDER_SIGNAL && <ReminderDaysField days={reminderDays(subscription)} disabled={!canManage || busy}
                        onCommit={days => void run(() => putManageNotificationSubscription(eventID, subscriptionBody(subscription, {Config: {days_before_start: days}})), t("manage.notifications.reminder.saved"), t("manage.notifications.reminder.error"))} />}
                </section>
                <section className="event-manage-section">
                    <div className="event-manage-section__head"><h2>{t("manage.email.templateTitle")}</h2><p>{t(mode === "edit" ? "manage.email.templateIntro" : "manage.email.previewOnlyIntro")}</p></div>
                    {versions.length > 1 && <div className="event-manage-notifications__versions" aria-label={t("manage.notifications.versions")}>{versions.map(item => <button className={`event-manage-notifications__version${template?.ID === item.ID ? " is-selected" : ""}`} type="button" key={item.ID} onClick={() => {setSelectedTemplateID(item.ID); setPreviewDraft(null);}}>{t("manage.notifications.versionLabel", {status: statusLabel(item.Status), date: new Date(item.UpdatedAt).toLocaleDateString("uk-UA")})}</button>)}</div>}
                    {template && draft ? <>
                        <TemplateActions mode={mode} status={statusLabel(template.Status)} canManage={canManage} busy={busy}
                            onCustomize={() => void mutateTemplate(() => customizeManageEmailTemplate(eventID, template), t("manage.notifications.customized"))}
                            onEdit={() => void mutateTemplate(() => rollbackManageEmailTemplate(eventID, template), t("manage.email.draftFromVersion"))}
                            onRestore={() => void mutateTemplate(() => rollbackManageEmailTemplate(eventID, template), t("manage.email.draftFromVersion"))}
                            onReset={() => run(async () => {await resetManageEmailTemplate(eventID, signal); setSelectedTemplateID(""); setPreviewDraft(null);}, t("manage.notifications.platformTemplateRestored"), t("manage.email.restoreError"))} />
                        {mode === "edit" && <>
                            <div className="event-manage-fields-two">
                                <div className="event-manage-field"><div className="event-manage-notifications__field-head"><ManageFieldLabel title={t("manage.email.subject")} help={t("manage.email.subjectHelp")} htmlFor="event-email-subject" required /><VariableInsert variables={variables} disabled={!editable} onInsert={name => insertInto("Subject", subjectRef.current, name)} /></div><input ref={subjectRef} className="event-manage-input" id="event-email-subject" value={draft.Subject} disabled={!editable} onChange={e => change({...draft, Subject: e.target.value})} /></div>
                                <div className="event-manage-field"><div className="event-manage-notifications__field-head"><ManageFieldLabel title={t("manage.email.preheader")} help={t("manage.email.preheaderHelp")} htmlFor="event-email-preheader" /><VariableInsert variables={variables} disabled={!editable} onInsert={name => insertInto("Preheader", preheaderRef.current, name)} /></div><input ref={preheaderRef} className="event-manage-input" id="event-email-preheader" value={draft.Preheader} disabled={!editable} onChange={e => change({...draft, Preheader: e.target.value})} placeholder={t("manage.email.optional")} /></div>
                            </div>
                            <EmailBlocksEditor blocks={draft.Body} disabled={!editable} variables={variables} onChange={blocks => change({...draft, Body: blocks})} onUploadImage={addImage} imageURL={fileID => getManageEmailImageURL(eventID, fileID)} />
                            {editable && validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                            <EmailStylingEditor styling={draft.Styling} disabled={!editable} onChange={styling => change({...draft, Styling: styling})} />
                        </>}
                        <div className="event-email-preview"><div className="event-email-preview__head"><div><h3>{t("manage.email.previewTitle")}</h3><p>{t("manage.email.previewIntro")}</p></div>{mode === "edit" && <button className="ib-btn ib-btn--sm" type="button" disabled={!valid} onClick={() => setPreviewDraft({templateID: template.ID, input: draft})}>{t("manage.email.previewRefresh")}</button>}</div>{previewStale && <p className="event-email-preview__stale">{t("manage.email.previewStale")}</p>}<EmailPreview event={event} input={previewInput} valid={valid} /></div>
                        {canManage && <div className="event-email-test"><div><strong>{t("manage.email.test")}</strong><p>{t(dirty ? "manage.email.testSavedOnly" : "manage.email.testHint")}</p>{testResult?.templateID === template.ID && <p className="event-email-test__result" role="status">{testResult.message}</p>}</div><EventButton className="ib-btn ib-btn--sm" type="button" disabled={testing || busy} onClick={() => void sendTest(template)} busy={testing}><Send size={15} /> {t("manage.email.sendTest")}</EventButton></div>}
                        {editable && <div className="event-manage-notifications__footer">{dirty && <span>{t("manage.notifications.unsaved")}</span>}<div><button className="ib-btn" type="button" disabled={!dirty || !valid || busy} onClick={() => void mutateTemplate(() => updateManageEmailTemplate(eventID, template.ID, draft), t("manage.email.draftSaved"))}>{t("manage.notifications.saveDraft")}</button><button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !valid || busy} onClick={() => void mutateTemplate(() => publishManageEmailTemplate(eventID, template), t("manage.email.published"))}>{t("manage.notifications.publish")}</button></div></div>}
                    </> : <div className="event-manage-notifications__empty"><EmptyState message={t("manage.email.noTemplate")} action={canManage ? <button className="ib-btn" type="button" disabled={busy} onClick={() => void mutateTemplate(() => createManageEmailTemplate(eventID, {NotificationType: signal, Subject: label.title, Preheader: "", Body: [emailRichTextBlock(label.description || label.title)], Styling: {}}), t("manage.email.draftCreated"))}>{t("manage.notifications.createTemplate")}</button> : undefined} /></div>}
                </section>
            </div>
        </div>
    </div>;
}
