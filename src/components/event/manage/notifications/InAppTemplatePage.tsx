"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {
    channelSignals, customizeManageInAppTemplate, getManageInAppTemplates, getManageNotificationSubscriptions,
    getManageNotificationTypes, publishManageInAppTemplate, resetManageInAppTemplate,
    rollbackManageInAppTemplate, signalLabel, updateManageInAppTemplate, type ManageInAppTemplate, type ManageInAppTemplateInput,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {useSubscriptionToggle} from "./useSubscriptionToggle";
import {t} from "@/i18n/t";
import {useManager} from "../ManagerShell";
import {InAppEditor} from "./InAppEditor";
import {InAppPreview} from "./InAppPreview";
import {inAppValidation} from "./inAppValidation";
import {orderedVersions, sameValue, sampleValues, templateMode, toVariableDefs} from "./notificationModel";
import {TemplateActions} from "./TemplateActions";
import {TemplateHeader} from "./TemplateHeader";
import {TemplateStatusTag} from "./TemplateStatusTag";
import {TemplateVersions} from "./TemplateVersions";
import {NotFoundScreen} from "@/components/event/NotFoundScreen";

const BASE = "/manage/notifications";

function inputOf(template: ManageInAppTemplate): ManageInAppTemplateInput {
    return {
        NotificationType: template.NotificationType, Title: template.Title, Body: template.Body,
        Link: template.Link, Icon: template.Icon, Tone: template.Tone, AccentColor: template.AccentColor,
        Surface: template.Surface, AutoDismissMs: template.AutoDismissMs,
        Actions: template.Actions, Dismissible: template.Dismissible,
    };
}

// The page of one in-app template of the event, laid out like admin's: header
// with the actions, versions, the fields on the left and the live preview on
// the right. The platform template is read-only until the event copies it.
export function InAppTemplatePage({signal, versionID}: {signal: string; versionID?: string}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-in-app-templates", eventID], queryFn: () => getManageInAppTemplates(eventID), refetchOnWindowFocus: false});
    const types = useQuery({queryKey: ["event-manage-notification-types", eventID], queryFn: () => getManageNotificationTypes(eventID), refetchOnWindowFocus: false});
    const [drafts, setDrafts] = useState<Record<string, ManageInAppTemplateInput>>({});
    const [busy, setBusy] = useState(false);
    const href = (id?: string) => `${BASE}/${encodeURIComponent(signal)}${id ? `?id=${id}` : ""}`;

    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "in_app");
    const subscription = rows.find(item => item.SignalType === signal);
    const versions = orderedVersions(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === versionID) ?? versions[0];
    const mode = templateMode(template);
    const type = types.data?.find(item => item.Type === signal);
    const saved = template ? inputOf(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && !sameValue(saved, draft));
    const validation = draft ? inAppValidation(draft) : "";
    const editable = !!(canManage && mode === "edit" && !busy);
    const ownVersions = versions.filter(item => item.Source === "event");

    async function run(action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> {
        if (!canManage || busy) return false;
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

    function mutate(action: () => Promise<ManageInAppTemplate>, success: string) {
        return run(async () => {
            const result = await action();
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
            router.replace(href(result.ID));
        }, success, t("manage.notifications.updateError"));
    }

    const toggleSubscription = useSubscriptionToggle(eventID, canManage, {success: t("manage.notifications.showUpdated"), failure: t("manage.notifications.showError")});
    const toggle = (enabled: boolean) => {if (subscription) toggleSubscription(subscription.SignalType, subscription.Channel, enabled);};

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label={t("manage.notifications.loading")} />;
    if (subscriptions.isError || templates.isError) return <EventLoadError message={t("manage.notifications.loadError")} error={subscriptions.error ?? templates.error} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} />;
    if (!channelSignals(rows, "in_app").includes(signal)) return <div className="event-manage-settings"><NotFoundScreen block title={t("manage.notifications.templateNotFoundTitle")} body={t("manage.notifications.templateNotFound")} /></div>;

    const label = signalLabel(signal);
    // One orange notice under the header: the untouched platform template, or a read-only copy (published/older version). A draft has none.
    const readOnlyHint = mode === "platform" ? t("manage.notifications.platformHint") : mode === "view" || mode === "previous" ? t("manage.notifications.readonlyHint") : "";
    return <div className="event-manage-settings event-template-page">
        <TemplateHeader backHref={BASE} backLabel={t("manage.notifications.title")} title={label.title} tag={<TemplateStatusTag status={mode === "platform" || mode === "none" ? "platform" : template!.Status} />}
            actions={<>
                {subscription && <EventSwitch checked={subscription.Enabled} disabled={!canManage || subscription.Required} ariaLabel={t("manage.notifications.switchHeadLabel")} onCheckedChange={toggle} />}
                {editable && <button className={`ib-btn${dirty ? " ib-btn--primary" : ""}`} type="button" disabled={!dirty || !!validation || busy} onClick={() => void mutate(() => updateManageInAppTemplate(eventID, template!.ID, draft!), t("manage.notifications.draftSaved"))}>{t("manage.notifications.saveDraft")}</button>}
                {editable && !dirty && <button className="ib-btn" type="button" disabled={!!validation || busy} onClick={() => void mutate(() => publishManageInAppTemplate(eventID, template!), t("manage.notifications.published"))}>{t("manage.notifications.publish")}</button>}
                <TemplateActions mode={mode} canManage={canManage} busy={busy}
                    onCustomize={() => void mutate(() => customizeManageInAppTemplate(eventID, template!), t("manage.notifications.customized"))}
                    onEdit={() => void mutate(() => rollbackManageInAppTemplate(eventID, template!), t("manage.notifications.draftFromPublished"))}
                    onRestore={() => void mutate(() => rollbackManageInAppTemplate(eventID, template!), t("manage.notifications.draftFromPrevious"))}
                    onReset={async () => { const done = await run(() => resetManageInAppTemplate(eventID, signal), t("manage.notifications.platformTemplateRestored"), t("manage.notifications.restoreError")); if (done) router.replace(href()); return done; }} />
            </>} />
        {readOnlyHint && <p className="event-template-page__hint" role="note" data-testid="template-notice">{readOnlyHint}</p>}
        {ownVersions.length > 0 && template && <TemplateVersions versions={ownVersions.map(item => ({ID: item.ID, Status: item.Status, UpdatedAt: item.UpdatedAt, PublishedAt: item.PublishedAt, Heading: item.Title}))} currentId={template.ID} hrefFor={href}
            canManage={canManage} dirty={dirty} busy={busy} onRestore={id => mutate(() => rollbackManageInAppTemplate(eventID, ownVersions.find(item => item.ID === id)!), t("manage.notifications.draftFromPrevious"))} />}
        {label.description && <p className="event-template-page__intro">{label.description}</p>}
        {template && draft ? <div className="event-template-grid">
            <div className="event-template-grid__fields">
                <InAppEditor draft={draft} disabled={!editable} variables={toVariableDefs(type?.Variables ?? [])} onChange={next => setDrafts(current => ({...current, [template.ID]: next}))} />
                {editable && validation && <p className="event-manage-validation" role="alert">{validation}</p>}
            </div>
            <div className="event-template-grid__preview">
                <h2>{t("manage.notifications.preview")}</h2>
                <InAppPreview template={draft} values={sampleValues(type, event.Name)} />
                <small>{t("manage.notifications.previewHint")}</small>
            </div>
        </div> : <EmptyState message={t("manage.notifications.noTemplate")} />}
    </div>;
}
