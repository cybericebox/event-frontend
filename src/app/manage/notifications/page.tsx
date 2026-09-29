"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {
    createManageInAppTemplate, customizeManageInAppTemplate, getManageInAppTemplates, getManageNotificationSubscriptions,
    getManageNotificationTypes, publishManageInAppTemplate, putManageNotificationSubscription, resetManageInAppTemplate,
    resetManageNotificationSubscription, rollbackManageInAppTemplate, channelSignals, signalLabel,
    updateManageInAppTemplate, type ManageInAppTemplate, type ManageInAppTemplateInput, type ManageNotificationSubscription,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useManager} from "@/components/event/manage/ManagerShell";
import {InAppEditor} from "@/components/event/manage/notifications/InAppEditor";
import {InAppPreview} from "@/components/event/manage/notifications/InAppPreview";
import {inAppValidation} from "@/components/event/manage/notifications/inAppValidation";
import {orderedVersions, sampleValues, templateMode} from "@/components/event/manage/notifications/notificationModel";
import {SignalHead, SignalList} from "@/components/event/manage/notifications/SignalList";
import {TemplateActions} from "@/components/event/manage/notifications/TemplateActions";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";

const statusLabel = (status: ManageInAppTemplate["Status"]) => t(`manage.notifications.status.${status}`);

function templateInput(template: ManageInAppTemplate): ManageInAppTemplateInput {
    return {
        NotificationType: template.NotificationType, Title: template.Title, Body: template.Body,
        Link: template.Link, Icon: template.Icon, Tone: template.Tone, AccentColor: template.AccentColor,
        Surface: template.Surface, AutoDismissMs: template.AutoDismissMs,
        Actions: template.Actions, Dismissible: template.Dismissible,
    };
}

function subscriptionBody(row: ManageNotificationSubscription, enabled: boolean) {
    return {SignalType: row.SignalType, Channel: row.Channel, Enabled: enabled, Audience: row.Audience};
}

export default function ManageNotificationsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-in-app-templates", eventID], queryFn: () => getManageInAppTemplates(eventID), refetchOnWindowFocus: false});
    const types = useQuery({queryKey: ["event-manage-notification-types", eventID], queryFn: () => getManageNotificationTypes(eventID), refetchOnWindowFocus: false});
    const [selectedSignal, setSignal] = useState("");
    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "in_app");
    const signals = channelSignals(rows, "in_app");
    const signal = signals.includes(selectedSignal) ? selectedSignal : signals[0] ?? "";
    const label = signalLabel(signal);
    const [selectedTemplateID, setSelectedTemplateID] = useState("");
    const [drafts, setDrafts] = useState<Record<string, ManageInAppTemplateInput>>({});
    const [busy, setBusy] = useState(false);
    const versions = orderedVersions(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === selectedTemplateID) ?? versions[0];
    const mode = templateMode(template);
    const subscription = rows.find(item => item.SignalType === signal);
    const type = types.data?.find(item => item.Type === signal);
    const variables = type?.Variables ?? [];
    const values = sampleValues(type, event.Name);
    const saved = template ? templateInput(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
    const validation = draft ? inAppValidation(draft) : "";
    const editable = !!(canManage && mode === "edit" && !busy);

    async function run(action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> {
        if (busy || !canManage) return false;
        setBusy(true);
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-manage-in-app-templates", eventID]}),
            ]);
            toast.success(success);
            return true;
        } catch {
            toast.error(failure);
            return false;
        } finally {setBusy(false);}
    }

    async function mutateTemplate(action: () => Promise<ManageInAppTemplate>, success: string) {
        return run(async () => {
            const result = await action();
            setSelectedTemplateID(result.ID);
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
        }, success, t("manage.notifications.updateError"));
    }

    function toggle(target: string, enabled: boolean) {
        const row = rows.find(item => item.SignalType === target);
        if (row) void run(() => putManageNotificationSubscription(eventID, subscriptionBody(row, enabled)), t("manage.notifications.showUpdated"), t("manage.notifications.showError"));
    }

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label={t("manage.notifications.loading")} />;
    if (subscriptions.isError || templates.isError) return <EventLoadError message={t("manage.notifications.loadError")} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} />;

    if (!signals.length) return <div className="event-manage-content event-manage-notifications"><header className="event-manage-heading"><div><h1>{t("manage.notifications.title")}</h1></div></header><section className="event-manage-section"><EmptyState message={t("manage.notifications.none")} /></section></div>;
    return <div className="event-manage-content event-manage-notifications">
        <header className="event-manage-heading"><div><h1>{t("manage.notifications.title")}</h1><p>{t("manage.notifications.intro")}</p></div></header>
        <div className="event-manage-notifications__layout">
            <SignalList signals={signals} rows={rows} selected={signal} canManage={canManage} busy={busy} ariaLabel={t("manage.notifications.listLabel")}
                onSelect={next => {setSignal(next); setSelectedTemplateID("");}} onToggle={toggle} />
            <div className="event-manage-notifications__main">
                <section className="event-manage-section">
                    <SignalHead signal={signal} row={subscription} canManage={canManage} busy={busy} help={t("manage.notifications.showHelp")} requiredHelp={t("manage.notifications.showRequiredHelp")}
                        onToggle={enabled => toggle(signal, enabled)}
                        onReset={() => void run(() => resetManageNotificationSubscription(eventID, signal, "in_app"), t("manage.notifications.settingReset"), t("manage.notifications.settingResetError"))} />
                    {!subscription && <EmptyState compact message={t("manage.notifications.noSetting")} />}
                </section>
                <section className="event-manage-section">
                    <div className="event-manage-section__head"><h2>{t("manage.notifications.textTitle")}</h2><p>{t(mode === "edit" ? "manage.notifications.textIntro" : "manage.notifications.previewIntro")}</p></div>
                    {versions.length > 1 && <div className="event-manage-notifications__versions" aria-label={t("manage.notifications.versions")}>{versions.map(item => <button className={`event-manage-notifications__version${template?.ID === item.ID ? " is-selected" : ""}`} type="button" key={item.ID} onClick={() => setSelectedTemplateID(item.ID)}>{t("manage.notifications.versionLabel", {status: statusLabel(item.Status), date: new Date(item.UpdatedAt).toLocaleDateString("uk-UA")})}</button>)}</div>}
                    {template && draft ? <>
                        <TemplateActions mode={mode} status={statusLabel(template.Status)} canManage={canManage} busy={busy}
                            onCustomize={() => void mutateTemplate(() => customizeManageInAppTemplate(eventID, template), t("manage.notifications.customized"))}
                            onEdit={() => void mutateTemplate(() => rollbackManageInAppTemplate(eventID, template), t("manage.notifications.draftFromPublished"))}
                            onRestore={() => void mutateTemplate(() => rollbackManageInAppTemplate(eventID, template), t("manage.notifications.draftFromPrevious"))}
                            onReset={() => run(async () => {await resetManageInAppTemplate(eventID, signal); setSelectedTemplateID("");}, t("manage.notifications.platformTemplateRestored"), t("manage.notifications.restoreError"))} />
                        {mode === "edit"
                            ? <div className="event-manage-notifications__editor">
                                <InAppEditor draft={draft} disabled={!editable} variables={variables} onChange={next => setDrafts(current => ({...current, [template.ID]: next}))} />
                                <div className="event-manage-notifications__preview"><h3>{t("manage.notifications.preview")}</h3><InAppPreview template={draft} values={values} /><small>{t("manage.notifications.previewHint")}</small></div>
                            </div>
                            : <div className="event-manage-notifications__preview event-manage-notifications__preview--wide"><InAppPreview template={draft} values={values} /><small>{t("manage.notifications.previewHint")}</small></div>}
                        {editable && validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                        {editable && <div className="event-manage-notifications__footer">{dirty && <span>{t("manage.notifications.unsaved")}</span>}<div><button className="ib-btn" type="button" disabled={!dirty || !!validation || busy} onClick={() => void mutateTemplate(() => updateManageInAppTemplate(eventID, template.ID, draft), t("manage.notifications.draftSaved"))}>{t("manage.notifications.saveDraft")}</button><button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !!validation || busy} onClick={() => void mutateTemplate(() => publishManageInAppTemplate(eventID, template), t("manage.notifications.published"))}>{t("manage.notifications.publish")}</button></div></div>}
                    </> : <div className="event-manage-notifications__empty"><EmptyState message={t("manage.notifications.noTemplate")} action={canManage ? <button className="ib-btn" type="button" disabled={busy} onClick={() => void mutateTemplate(() => createManageInAppTemplate(eventID, {NotificationType: signal, Title: label.title, Body: label.description || label.title, Link: "", Icon: "bell", Tone: "info", AccentColor: "", Surface: "inbox", AutoDismissMs: 5000, Actions: [], Dismissible: true}), t("manage.notifications.draftCreated"))}>{t("manage.notifications.createTemplate")}</button> : undefined} /></div>}
                </section>
            </div>
        </div>
    </div>;
}
