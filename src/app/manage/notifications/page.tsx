"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {RotateCcw} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    createManageInAppTemplate, customizeManageInAppTemplate, getManageInAppTemplates, getManageNotificationSubscriptions,
    publishManageInAppTemplate, putManageNotificationSubscription, resetManageInAppTemplate,
    resetManageNotificationSubscription, rollbackManageInAppTemplate, channelSignals, signalGroups, signalLabel,
    updateManageInAppTemplate, type ManageInAppTemplate, type ManageInAppTemplateInput,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {NotificationMessageCard} from "@/components/event/NotificationMessageCard";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventSwitch} from "@/components/ui/EventSwitch";

const statusLabel = (status: ManageInAppTemplate["Status"]) => t(`manage.notifications.status.${status}`);

function templateInput(template: ManageInAppTemplate): ManageInAppTemplateInput {
    return {
        NotificationType: template.NotificationType, Title: template.Title, Body: template.Body,
        Link: template.Link, Icon: template.Icon, Tone: template.Tone, AccentColor: template.AccentColor,
        Surface: template.Surface, AutoDismissMs: template.AutoDismissMs,
        Actions: template.Actions, Dismissible: template.Dismissible,
    };
}

function orderedTemplates(items: ManageInAppTemplate[], signal: string) {
    return items.filter(item => item.NotificationType === signal).sort((a, b) => {
        const rank = (item: ManageInAppTemplate) => item.Status === "draft" ? 0 : item.Status === "published" ? 1 : 2;
        return rank(a) - rank(b) || b.UpdatedAt.localeCompare(a.UpdatedAt);
    });
}

function previewText(value: string, eventName: string) {
    return value.replaceAll("{{.event_name}}", eventName);
}

export default function ManageNotificationsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-in-app-templates", eventID], queryFn: () => getManageInAppTemplates(eventID), refetchOnWindowFocus: false});
    const [selectedSignal, setSignal] = useState("");
    const signals = channelSignals(subscriptions.data ?? [], "in_app");
    const signal = signals.includes(selectedSignal) ? selectedSignal : signals[0] ?? "";
    const label = signalLabel(signal);
    const [selectedTemplateID, setSelectedTemplateID] = useState("");
    const [drafts, setDrafts] = useState<Record<string, ManageInAppTemplateInput>>({});
    const [busy, setBusy] = useState(false);
    const versions = orderedTemplates(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === selectedTemplateID) ?? versions[0];
    const subscription = subscriptions.data?.find(item => item.SignalType === signal && item.Channel === "in_app");
    const saved = template ? templateInput(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
    const valid = !!draft?.Title.trim() && !!draft.Body.trim();
    const editable = !!(canManage && template?.Source === "event" && template.Status === "draft" && !busy);

    async function run(action: () => Promise<unknown>, success: string, failure: string) {
        if (busy || !canManage) return;
        setBusy(true);
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-manage-in-app-templates", eventID]}),
            ]);
            toast.success(success);
        } catch {toast.error(failure);}
        finally {setBusy(false);}
    }

    async function mutateTemplate(action: () => Promise<ManageInAppTemplate>, success: string) {
        await run(async () => {
            const result = await action();
            setSelectedTemplateID(result.ID);
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
        }, success, t("manage.notifications.updateError"));
    }

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label={t("manage.notifications.loading")} />;
    if (subscriptions.isError || templates.isError) return <EventLoadError message={t("manage.notifications.loadError")} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} />;

    if (!signals.length) return <div className="event-manage-content event-manage-notifications"><header className="event-manage-heading"><div><h1>{t("manage.notifications.title")}</h1></div></header><section className="event-manage-section"><EmptyState message={t("manage.notifications.none")} /></section></div>;
    return <div className="event-manage-content event-manage-notifications">
        <header className="event-manage-heading"><div><h1>{t("manage.notifications.title")}</h1><p>{t("manage.notifications.intro")}</p></div></header>
        <div className="event-manage-notifications__layout">
            <nav className="event-manage-section event-manage-notifications__list" aria-label={t("manage.notifications.listLabel")}>
                {signalGroups(signals).map(({group, signals: items}) => <div className="event-manage-notifications__group" key={group}><h2>{group}</h2>{items.map(item => {
                    const row = subscriptions.data.find(entry => entry.SignalType === item && entry.Channel === "in_app");
                    return <button className={`event-manage-notifications__item${signal === item ? " is-selected" : ""}`} type="button" key={item} aria-current={signal === item ? "true" : undefined} onClick={() => {setSignal(item); setSelectedTemplateID("");}}><span>{signalLabel(item).title}</span><small>{t(row?.Required ? "manage.notifications.required" : row?.Enabled ? "manage.notifications.enabled" : "manage.notifications.disabled")}</small></button>;
                })}</div>)}
            </nav>
            <div className="event-manage-notifications__main">
                <section className="event-manage-section">
                    <div className="event-manage-section__head"><h2>{label.title}</h2>{label.description && <p>{label.description}</p>}</div>
                    {subscription?.Required ? <div className="event-manage-notifications__delivery"><div><ManageFieldLabel title={t("manage.notifications.show")} help={t("manage.notifications.showRequiredHelp")} /><small>{t("manage.notifications.requiredNotice")}</small></div><div className="event-manage-notifications__delivery-actions"><span className="event-manage-notifications__required">{t("manage.notifications.required")}</span></div></div> : subscription ? <div className="event-manage-notifications__delivery"><div><ManageFieldLabel title={t("manage.notifications.show")} help={t("manage.notifications.showHelp")} /><small>{t(subscription.Source === "event" ? "manage.notifications.eventSetting" : "manage.notifications.platformSetting")}</small></div><div className="event-manage-notifications__delivery-actions"><EventSwitch className="event-manage-form__switch" checked={subscription.Enabled} disabled={!canManage || busy} onCheckedChange={checked => void run(() => putManageNotificationSubscription(eventID, {...subscription, Enabled: checked}), t("manage.notifications.showUpdated"), t("manage.notifications.showError"))} label={t(subscription.Enabled ? "manage.notifications.enabled" : "manage.notifications.disabled")} />{subscription.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void run(() => resetManageNotificationSubscription(eventID, signal, "in_app"), t("manage.notifications.settingReset"), t("manage.notifications.settingResetError"))} title={t("manage.notifications.resetTitle")}><RotateCcw size={15} /> {t("manage.notifications.reset")}</button>}</div></div> : <EmptyState compact message={t("manage.notifications.noSetting")} />}
                </section>
                <section className="event-manage-section">
                    <div className="event-manage-notifications__template-head"><div className="event-manage-section__head"><h2>{t("manage.notifications.textTitle")}</h2><p>{t("manage.notifications.textIntro")}</p></div>{template?.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy || dirty} onClick={() => void run(async () => {await resetManageInAppTemplate(eventID, signal); setSelectedTemplateID("");}, t("manage.notifications.platformTemplateRestored"), t("manage.notifications.restoreError"))}><RotateCcw size={15} /> {t("manage.notifications.restoreDefault")}</button>}</div>
                    {versions.length > 1 && <div className="event-manage-notifications__versions" aria-label={t("manage.notifications.versions")}>{versions.map(item => <button className={`event-manage-notifications__version${template?.ID === item.ID ? " is-selected" : ""}`} type="button" key={item.ID} onClick={() => setSelectedTemplateID(item.ID)}>{t("manage.notifications.versionLabel", {status: statusLabel(item.Status), date: new Date(item.UpdatedAt).toLocaleDateString("uk-UA")})}</button>)}</div>}
                    {template && draft ? <>
                        <div className="event-manage-notifications__state"><span>{template.Source === "platform" ? t("manage.notifications.platformTemplate") : statusLabel(template.Status)}</span>{template.Source === "platform" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => customizeManageInAppTemplate(eventID, template), t("manage.notifications.customized"))}>{t("manage.notifications.customize")}</button>}{template.Source === "event" && template.Status === "published" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => rollbackManageInAppTemplate(eventID, template), t("manage.notifications.draftFromPublished"))}>{t("manage.notifications.editCopy")}</button>}{template.Source === "event" && template.Status === "unpublished" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => rollbackManageInAppTemplate(eventID, template), t("manage.notifications.draftFromPrevious"))}>{t("manage.notifications.restoreAsDraft")}</button>}</div>
                        <div className="event-manage-notifications__editor"><div className="event-manage-notifications__fields"><label className="event-manage-field"><span>{t("manage.notifications.field.title")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={draft.Title} disabled={!editable} maxLength={200} onChange={e => setDrafts(current => ({...current, [template.ID]: {...draft, Title: e.target.value}}))} /></label><label className="event-manage-field"><span>{t("manage.notifications.field.body")}<span className="event-field-required">*</span></span><textarea className="event-manage-input" rows={5} value={draft.Body} disabled={!editable} onChange={e => setDrafts(current => ({...current, [template.ID]: {...draft, Body: e.target.value}}))} /></label><label className="event-manage-field"><ManageFieldLabel title={t("manage.notifications.field.link")} help={t("manage.notifications.field.linkHelp")} /><input className="event-manage-input" value={draft.Link} disabled={!editable} onChange={e => setDrafts(current => ({...current, [template.ID]: {...draft, Link: e.target.value}}))} placeholder={t("manage.notifications.field.linkPlaceholder")} /></label></div><div className="event-manage-notifications__preview"><h3>{t("manage.notifications.preview")}</h3><NotificationMessageCard icon={draft.Icon} tone={draft.Tone} accentColor={draft.AccentColor} title={previewText(draft.Title || t("manage.notifications.previewTitle"), event.Name)} body={previewText(draft.Body || t("manage.notifications.previewBody"), event.Name)} /><small>{t("manage.notifications.previewHint")}</small></div></div>
                        {editable && <div className="event-manage-notifications__footer">{dirty && <span>{t("manage.notifications.unsaved")}</span>}<div><button className="ib-btn" type="button" disabled={!dirty || !valid || busy} onClick={() => void mutateTemplate(() => updateManageInAppTemplate(eventID, template.ID, draft), t("manage.notifications.draftSaved"))}>{t("manage.notifications.saveDraft")}</button><button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !valid || busy} onClick={() => void mutateTemplate(() => publishManageInAppTemplate(eventID, template), t("manage.notifications.published"))}>{t("manage.notifications.publish")}</button></div></div>}
                    </> : <div className="event-manage-notifications__empty"><EmptyState message={t("manage.notifications.noTemplate")} />{canManage && <button className="ib-btn" type="button" disabled={busy} onClick={() => void mutateTemplate(() => createManageInAppTemplate(eventID, {NotificationType: signal, Title: label.title, Body: label.description || label.title, Link: "", Icon: "bell", Tone: "info", AccentColor: "", Surface: "inbox", AutoDismissMs: 5000, Actions: [], Dismissible: true}), t("manage.notifications.draftCreated"))}>{t("manage.notifications.createTemplate")}</button>}</div>}
                </section>
            </div>
        </div>
    </div>;
}
