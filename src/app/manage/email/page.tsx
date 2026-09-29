"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {RotateCcw, Send} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    createManageEmailTemplate, customizeManageEmailTemplate, getManageEmailTemplates,
    getManageEmailImageURL, uploadManageEmailImage,
    previewManageEmailTemplate, publishManageEmailTemplate, resetManageEmailTemplate,
    rollbackManageEmailTemplate, sendManageEmailTemplateTest, updateManageEmailTemplate,
    type ManageEmailTemplate, type ManageEmailTemplateInput,
} from "@/api/manageEmailTemplates";
import {
    getManageNotificationSubscriptions, putManageNotificationSubscription,
    resetManageNotificationSubscription, channelSignals, signalGroups, signalLabel,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EmailBlocksEditor} from "@/components/event/manage/EmailBlocksEditor";
import {EmailStylingEditor} from "@/components/event/manage/EmailStylingEditor";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {emailRichText, emailRichTextBlock} from "@/components/event/manage/emailBlocks";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";

const statusLabel = (status: ManageEmailTemplate["Status"]) => t(`manage.notifications.status.${status}`);

function inputOf(template: ManageEmailTemplate): ManageEmailTemplateInput {
    return {NotificationType: template.NotificationType, Subject: template.Subject, Preheader: template.Preheader, Body: template.Body, Styling: template.Styling};
}

function versionsOf(items: ManageEmailTemplate[], signal: string) {
    return items.filter(item => item.NotificationType === signal).sort((a, b) => {
        const rank = (item: ManageEmailTemplate) => item.Status === "draft" ? 0 : item.Status === "published" ? 1 : 2;
        return rank(a) - rank(b) || b.UpdatedAt.localeCompare(a.UpdatedAt);
    });
}

export default function ManageEmailPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const [selectedSignal, setSignal] = useState("");
    const signals = channelSignals(subscriptions.data ?? [], "email");
    const signal = signals.includes(selectedSignal) ? selectedSignal : signals[0] ?? "";
    const label = signalLabel(signal);
    const [testResult, setTestResult] = useState<{templateID: string; message: string} | null>(null);
    const [testing, setTesting] = useState(false);
    const [selectedTemplateID, setSelectedTemplateID] = useState("");
    const [drafts, setDrafts] = useState<Record<string, ManageEmailTemplateInput>>({});
    const [previewDraft, setPreviewDraft] = useState<{templateID: string; input: ManageEmailTemplateInput} | null>(null);
    const [busy, setBusy] = useState(false);
    const versions = versionsOf(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === selectedTemplateID) ?? versions[0];
    const subscription = subscriptions.data?.find(item => item.SignalType === signal && item.Channel === "email");
    const saved = template ? inputOf(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
    const validation = !draft?.Subject.trim() ? t("manage.email.validation.subject")
        : !draft.Body.length || !draft.Body.some(block => block.type === "rich_text" && emailRichText(block).trim() || block.type === "button" || block.type === "image" || block.type === "preset") ? t("manage.email.validation.body")
        : draft.Body.some(block => block.type === "button" && (!String(block.label ?? "").trim() || !String(block.url ?? "").trim())) ? t("manage.email.validation.buttons")
        : "";
    const valid = !validation;
    const editable = !!(canManage && template?.Source === "event" && template.Status === "draft" && !busy);
    const previewInput = template && draft ? previewDraft?.templateID === template.ID ? previewDraft.input : saved : null;
    const previewStale = !!(dirty && (!previewDraft || previewDraft.templateID !== template?.ID || JSON.stringify(previewDraft.input) !== JSON.stringify(draft)));
    const preview = useQuery({
        queryKey: ["event-manage-email-preview", eventID, template?.ID, previewInput && JSON.stringify(previewInput)],
        queryFn: () => previewManageEmailTemplate(eventID, previewInput!),
        enabled: !!previewInput, retry: false, refetchOnWindowFocus: false,
    });

    function change(input: ManageEmailTemplateInput) {
        if (!template) return;
        setDrafts(current => ({...current, [template.ID]: input}));
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

    async function run(action: () => Promise<unknown>, success: string, failure: string) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-manage-email-templates", eventID]}),
            ]);
            toast.success(success);
        } catch {toast.error(failure);}
        finally {setBusy(false);}
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
        await run(async () => {
            const result = await action();
            setSelectedTemplateID(result.ID);
            setPreviewDraft(null);
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
        }, success, t("manage.email.updateError"));
    }

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label={t("manage.email.loading")} />;
    if (subscriptions.isError || templates.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.email.loadError")}</h1><button className="ib-btn" type="button" onClick={() => {void subscriptions.refetch(); void templates.refetch();}}>{t("common.retry")}</button></div>;
    if (!signals.length) return <div className="event-manage-content event-manage-notifications event-manage-email"><header className="event-manage-heading"><div><h1>{t("manage.email.title")}</h1></div></header><section className="event-manage-section"><EmptyState message={t("manage.email.none")} /></section></div>;

    return <div className="event-manage-content event-manage-notifications event-manage-email">
        <header className="event-manage-heading"><div><h1>{t("manage.email.title")}</h1><p>{t("manage.email.intro")}</p></div></header>
        <div className="event-manage-notifications__layout">
            <nav className="event-manage-section event-manage-notifications__list" aria-label={t("manage.email.listLabel")}>{signalGroups(signals).map(({group, signals: items}) => <div className="event-manage-notifications__group" key={group}><h2>{group}</h2>{items.map(item => {
                const row = subscriptions.data.find(entry => entry.SignalType === item && entry.Channel === "email");
                return <button className={`event-manage-notifications__item${signal === item ? " is-selected" : ""}`} type="button" key={item} aria-current={signal === item ? "true" : undefined} onClick={() => {setSignal(item); setSelectedTemplateID(""); setPreviewDraft(null);}}><span>{signalLabel(item).title}</span><small>{t(row?.Required ? "manage.notifications.required" : row?.Enabled ? "manage.notifications.enabled" : "manage.notifications.disabled")}</small></button>;
            })}</div>)}</nav>
            <div className="event-manage-notifications__main">
                <section className="event-manage-section"><div className="event-manage-section__head"><h2>{label.title}</h2>{label.description && <p>{label.description}</p>}</div>{subscription?.Required ? <div className="event-manage-notifications__delivery"><div><ManageFieldLabel title={t("manage.email.send")} help={t("manage.email.sendRequiredHelp")} /><small>{t("manage.email.alwaysSent")}</small></div><div className="event-manage-notifications__delivery-actions"><span className="event-manage-notifications__required">{t("manage.notifications.required")}</span></div></div> : subscription ? <div className="event-manage-notifications__delivery"><div><ManageFieldLabel title={t("manage.email.send")} help={t("manage.email.sendHelp")} /><small>{t(subscription.Source === "event" ? "manage.notifications.eventSetting" : "manage.notifications.platformSetting")}</small></div><div className="event-manage-notifications__delivery-actions"><EventSwitch className="event-manage-form__switch" checked={subscription.Enabled} disabled={!canManage || busy} onCheckedChange={checked => void run(() => putManageNotificationSubscription(eventID, {...subscription, Enabled: checked}), t("manage.email.sendUpdated"), t("manage.email.sendError"))} label={t(subscription.Enabled ? "manage.notifications.enabled" : "manage.notifications.disabled")} />{subscription.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void run(() => resetManageNotificationSubscription(eventID, signal, "email"), t("manage.notifications.settingReset"), t("manage.notifications.settingResetError"))}><RotateCcw size={15} /> {t("manage.notifications.reset")}</button>}</div></div> : <EmptyState compact message={t("manage.email.noSetting")} />}</section>
                <section className="event-manage-section"><div className="event-manage-notifications__template-head"><div className="event-manage-section__head"><h2>{t("manage.email.templateTitle")}</h2><p>{t("manage.email.templateIntro")}</p></div>{template?.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy || dirty} onClick={() => void run(async () => {await resetManageEmailTemplate(eventID, signal); setSelectedTemplateID(""); setPreviewDraft(null);}, t("manage.notifications.platformTemplateRestored"), t("manage.email.restoreError"))}><RotateCcw size={15} /> {t("manage.notifications.restoreDefault")}</button>}</div>
                    {versions.length > 1 && <div className="event-manage-notifications__versions" aria-label={t("manage.notifications.versions")}>{versions.map(item => <button className={`event-manage-notifications__version${template?.ID === item.ID ? " is-selected" : ""}`} type="button" key={item.ID} onClick={() => {setSelectedTemplateID(item.ID); setPreviewDraft(null);}}>{t("manage.notifications.versionLabel", {status: statusLabel(item.Status), date: new Date(item.UpdatedAt).toLocaleDateString("uk-UA")})}</button>)}</div>}
                    {template && draft ? <><div className="event-manage-notifications__state"><span>{template.Source === "platform" ? t("manage.notifications.platformTemplate") : statusLabel(template.Status)}</span>{template.Source === "platform" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => customizeManageEmailTemplate(eventID, template), t("manage.notifications.customized"))}>{t("manage.notifications.customize")}</button>}{template.Source === "event" && template.Status !== "draft" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => rollbackManageEmailTemplate(eventID, template), t("manage.email.draftFromVersion"))}>{t(template.Status === "published" ? "manage.notifications.editCopy" : "manage.notifications.restoreAsDraft")}</button>}</div>
                        <div className="event-manage-fields-two"><div className="event-manage-field"><ManageFieldLabel title={t("manage.email.subject")} help={t("manage.email.subjectHelp")} htmlFor="event-email-subject" required /><input className="event-manage-input" id="event-email-subject" value={draft.Subject} disabled={!editable} onChange={e => change({...draft, Subject: e.target.value})} /></div><div className="event-manage-field"><ManageFieldLabel title={t("manage.email.preheader")} help={t("manage.email.preheaderHelp")} htmlFor="event-email-preheader" /><input className="event-manage-input" id="event-email-preheader" value={draft.Preheader} disabled={!editable} onChange={e => change({...draft, Preheader: e.target.value})} placeholder={t("manage.email.optional")} /></div></div>
                        <EmailBlocksEditor blocks={draft.Body} disabled={!editable} onChange={blocks => change({...draft, Body: blocks})} onUploadImage={addImage} imageURL={fileID => getManageEmailImageURL(eventID, fileID)} />
                        {editable && validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                        <EmailStylingEditor styling={draft.Styling} disabled={!editable} onChange={styling => change({...draft, Styling: styling})} />
                        <div className="event-email-preview"><div className="event-email-preview__head"><div><h3>{t("manage.email.previewTitle")}</h3><p>{t("manage.email.previewIntro")}</p></div><button className="ib-btn ib-btn--sm" type="button" disabled={preview.isFetching || !valid} onClick={() => setPreviewDraft({templateID: template.ID, input: draft})}>{t("manage.email.previewRefresh")}</button></div>{previewStale && <p className="event-email-preview__stale">{t("manage.email.previewStale")}</p>}{preview.isPending || preview.isFetching ? <EventLoading event={event} message={t("manage.email.previewLoading")} /> : preview.isError ? <div className="event-manage-feedback event-manage-feedback--error" role="alert">{t("manage.email.previewError")}</div> : <iframe title={t("manage.email.previewFrame")} sandbox="" srcDoc={preview.data.HTML} />}</div>
                        {canManage && <div className="event-email-test"><div><strong>{t("manage.email.test")}</strong><p>{t(dirty ? "manage.email.testSavedOnly" : "manage.email.testHint")}</p>{testResult?.templateID === template.ID && <p className="event-email-test__result" role="status">{testResult.message}</p>}</div><EventButton className="ib-btn ib-btn--sm" type="button" disabled={testing || busy} onClick={() => void sendTest(template)} busy={testing}><Send size={15} /> {t("manage.email.sendTest")}</EventButton></div>}
                        {editable && <div className="event-manage-notifications__footer">{dirty && <span>{t("manage.notifications.unsaved")}</span>}<div><button className="ib-btn" type="button" disabled={!dirty || !valid || busy} onClick={() => void mutateTemplate(() => updateManageEmailTemplate(eventID, template.ID, draft), t("manage.email.draftSaved"))}>{t("manage.notifications.saveDraft")}</button><button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !valid || busy} onClick={() => void mutateTemplate(() => publishManageEmailTemplate(eventID, template), t("manage.email.published"))}>{t("manage.notifications.publish")}</button></div></div>}
                    </> : <div className="event-manage-notifications__empty"><EmptyState message={t("manage.email.noTemplate")} />{canManage && <button className="ib-btn" type="button" disabled={busy} onClick={() => void mutateTemplate(() => createManageEmailTemplate(eventID, {NotificationType: signal, Subject: label.title, Preheader: "", Body: [emailRichTextBlock(label.description || label.title)], Styling: {}}), t("manage.email.draftCreated"))}>{t("manage.notifications.createTemplate")}</button>}</div>}
                </section>
            </div>
        </div>
    </div>;
}
