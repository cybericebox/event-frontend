"use client";

import {useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Send} from "lucide-react";
import Link from "next/link";
import {toast} from "react-hot-toast";
import {
    customizeManageEmailTemplate, getManageEmailImageURL, getManageEmailTemplates, publishManageEmailTemplate,
    resetManageEmailTemplate, rollbackManageEmailTemplate, sendManageEmailTemplateTest, updateManageEmailTemplate,
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
import {t} from "@/i18n/t";
import {EmailBlocksEditor} from "../EmailBlocksEditor";
import {EmailStylingEditor} from "../EmailStylingEditor";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {useManager} from "../ManagerShell";
import {emailRichText} from "../emailBlocks";
import {EmailPreview} from "./EmailPreview";
import {insertAtCaret, orderedVersions, templateMode, variableToken} from "./notificationModel";
import {ReminderDaysField} from "./ReminderDaysField";
import {TemplateActions} from "./TemplateActions";
import {TemplateHeader} from "./TemplateHeader";
import {TemplateStatusTag} from "./TemplateStatusTag";
import {TemplateVersions} from "./TemplateVersions";
import {useDebounced} from "./useDebounced";
import {VariableInsert} from "./VariableInsert";

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
    const types = useQuery({queryKey: ["event-manage-notification-types", eventID], queryFn: () => getManageNotificationTypes(eventID), refetchOnWindowFocus: false});
    const [drafts, setDrafts] = useState<Record<string, ManageEmailTemplateInput>>({});
    const [busy, setBusy] = useState(false);
    const [testing, setTesting] = useState(false);
    const subjectRef = useRef<HTMLInputElement>(null);
    const preheaderRef = useRef<HTMLInputElement>(null);
    const href = (id?: string) => `${BASE}/${encodeURIComponent(signal)}${id ? `?id=${id}` : ""}`;

    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "email");
    const subscription = rows.find(item => item.SignalType === signal);
    const versions = orderedVersions(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === versionID) ?? versions[0];
    const mode = templateMode(template);
    const variables = types.data?.find(item => item.Type === signal)?.Variables ?? [];
    const saved = template ? inputOf(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
    const validation = !draft?.Subject.trim() ? t("manage.email.validation.subject")
        : !draft.Body.length || !draft.Body.some(block => block.type === "rich_text" && emailRichText(block).trim() || block.type === "button" || block.type === "image" || block.type === "preset") ? t("manage.email.validation.body")
        : draft.Body.some(block => block.type === "button" && (!String(block.label ?? "").trim() || !String(block.url ?? "").trim())) ? t("manage.email.validation.buttons")
        : "";
    const editable = !!(canManage && mode === "edit" && !busy);
    const livePreview = useDebounced(draft && !validation ? draft : null);
    const ownVersions = versions.filter(item => item.Source === "event");

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

    function mutate(action: () => Promise<ManageEmailTemplate>, success: string) {
        return run(async () => {
            const result = await action();
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
            router.replace(href(result.ID));
        }, success, t("manage.email.updateError"));
    }

    function change(input: ManageEmailTemplateInput) {
        if (template) setDrafts(current => ({...current, [template.ID]: input}));
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

    async function sendTest() {
        if (!template || !canManage || testing) return;
        setTesting(true);
        try {
            const result = await sendManageEmailTemplateTest(eventID, template.ID);
            toast.success(t("manage.email.testSent", {recipient: result.Recipient}));
        } catch {toast.error(t("manage.email.testError"));}
        finally {setTesting(false);}
    }

    function toggle(enabled: boolean) {
        if (subscription) void run(() => putManageNotificationSubscription(eventID, {SignalType: subscription.SignalType, Channel: subscription.Channel, Enabled: enabled, Audience: subscription.Audience}), t("manage.email.sendUpdated"), t("manage.email.sendError"));
    }

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label={t("manage.email.loading")} />;
    if (subscriptions.isError || templates.isError) return <EventLoadError message={t("manage.email.loadError")} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} />;
    if (!channelSignals(rows, "email").includes(signal)) return <div className="event-manage-settings"><Link className="event-template-header__back" href={BASE}>{t("manage.email.title")}</Link><EmptyState message={t("manage.notifications.templateNotFound")} /></div>;

    const label = signalLabel(signal);
    const readOnlyHint = mode === "platform" ? t("manage.notifications.platformHint") : mode === "none" ? "" : t("manage.notifications.readonlyHint");
    return <div className="event-manage-settings event-template-page">
        <TemplateHeader backHref={BASE} backLabel={t("manage.email.title")} title={label.title} tag={<TemplateStatusTag status={mode === "platform" || mode === "none" ? "platform" : template!.Status} />}
            actions={<>
                {subscription && <EventSwitch checked={subscription.Enabled} disabled={!canManage || busy || subscription.Required} ariaLabel={t("manage.notifications.switchHeadLabel")} onCheckedChange={toggle} />}
                {canManage && template && <EventButton className="ib-btn" type="button" disabled={testing || busy} busy={testing} onClick={() => void sendTest()}><Send size={15} /> {t("manage.email.sendTest")}</EventButton>}
                {editable && <button className={`ib-btn${dirty ? " ib-btn--primary" : ""}`} type="button" disabled={!dirty || !!validation || busy} onClick={() => void mutate(() => updateManageEmailTemplate(eventID, template!.ID, draft!), t("manage.email.draftSaved"))}>{t("manage.notifications.saveDraft")}</button>}
                {editable && !dirty && <button className="ib-btn" type="button" disabled={!!validation || busy} onClick={() => void mutate(() => publishManageEmailTemplate(eventID, template!), t("manage.email.published"))}>{t("manage.notifications.publish")}</button>}
                <TemplateActions mode={mode} canManage={canManage} busy={busy}
                    onCustomize={() => void mutate(() => customizeManageEmailTemplate(eventID, template!), t("manage.notifications.customized"))}
                    onEdit={() => void mutate(() => rollbackManageEmailTemplate(eventID, template!), t("manage.email.draftFromVersion"))}
                    onRestore={() => void mutate(() => rollbackManageEmailTemplate(eventID, template!), t("manage.email.draftFromVersion"))}
                    onReset={async () => { const done = await run(() => resetManageEmailTemplate(eventID, signal), t("manage.notifications.platformTemplateRestored"), t("manage.email.restoreError")); if (done) router.replace(href()); return done; }} />
            </>} />
        {ownVersions.length > 0 && template && <TemplateVersions versions={ownVersions.map(item => ({ID: item.ID, Status: item.Status, UpdatedAt: item.UpdatedAt, PublishedAt: item.PublishedAt, Heading: item.Subject}))} currentId={template.ID} hrefFor={href}
            canManage={canManage} dirty={dirty} busy={busy} onRestore={id => mutate(() => rollbackManageEmailTemplate(eventID, ownVersions.find(item => item.ID === id)!), t("manage.email.draftFromVersion"))} />}
        {label.description && <p className="event-template-page__intro">{label.description}</p>}
        {subscription && signal === REMINDER_SIGNAL && <ReminderDaysField days={reminderDays(subscription)} disabled={!canManage || busy}
            onCommit={days => void run(() => putManageNotificationSubscription(eventID, {SignalType: subscription.SignalType, Channel: subscription.Channel, Enabled: subscription.Enabled, Audience: subscription.Audience, Config: {days_before_start: days}}), t("manage.notifications.reminder.saved"), t("manage.notifications.reminder.error"))} />}
        {template && draft ? <div className="event-template-grid">
            <div className="event-template-grid__fields">
                {readOnlyHint && <p className="event-template-page__hint">{readOnlyHint}</p>}
                <div className="event-manage-field"><div className="event-manage-notifications__field-head"><ManageFieldLabel title={t("manage.email.subject")} help={t("manage.email.subjectHelp")} htmlFor="event-email-subject" required /><VariableInsert variables={variables} disabled={!editable} onInsert={name => insertInto("Subject", subjectRef.current, name)} /></div><input ref={subjectRef} className="event-manage-input" id="event-email-subject" value={draft.Subject} disabled={!editable} onChange={e => change({...draft, Subject: e.target.value})} /></div>
                <div className="event-manage-field"><div className="event-manage-notifications__field-head"><ManageFieldLabel title={t("manage.email.preheader")} help={t("manage.email.preheaderHelp")} htmlFor="event-email-preheader" /><VariableInsert variables={variables} disabled={!editable} onInsert={name => insertInto("Preheader", preheaderRef.current, name)} /></div><input ref={preheaderRef} className="event-manage-input" id="event-email-preheader" value={draft.Preheader} disabled={!editable} onChange={e => change({...draft, Preheader: e.target.value})} placeholder={t("manage.email.optional")} /></div>
                <EmailBlocksEditor blocks={draft.Body} disabled={!editable} variables={variables} onChange={blocks => change({...draft, Body: blocks})} onUploadImage={addImage} imageURL={fileID => getManageEmailImageURL(eventID, fileID)} />
                {editable && validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                <EmailStylingEditor styling={draft.Styling} disabled={!editable} onChange={styling => change({...draft, Styling: styling})} />
            </div>
            <div className="event-template-grid__preview">
                <h2>{t("manage.email.previewTitle")}</h2>
                <EmailPreview event={event} input={livePreview} valid={!validation} />
            </div>
        </div> : <EmptyState message={t("manage.email.noTemplate")} />}
    </div>;
}
