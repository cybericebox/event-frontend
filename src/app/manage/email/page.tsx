"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageEmailTemplates} from "@/api/manageEmailTemplates";
import {getManageNotificationSubscriptions, channelSignals} from "@/api/manageNotifications";
import {useManager} from "@/components/event/manage/ManagerShell";
import {TemplateList} from "@/components/event/manage/notifications/TemplateList";
import {useSubscriptionToggle} from "@/components/event/manage/notifications/useSubscriptionToggle";
import {t} from "@/i18n/t";

// «Електронні листи»: the emails of the event, like admin's template list.
export default function ManageEmailPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "email");

    const toggle = useSubscriptionToggle(eventID, canManage, {success: t("manage.email.sendUpdated"), failure: t("manage.email.sendError")});

    const state = subscriptions.isPending || templates.isPending ? "loading" : subscriptions.isError || templates.isError ? "error" : "ready";
    return <div className="event-manage-settings event-journal">
        <header className="event-manage-heading"><div><h1>{t("manage.email.title")}</h1><p>{t("manage.email.intro")}</p></div></header>
        <TemplateList event={event} state={state} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} error={subscriptions.error ?? templates.error} loadingLabel={t("manage.email.loading")} errorMessage={t("manage.email.loadError")} emptyMessage={t("manage.email.none")}
            signals={channelSignals(rows, "email")} rows={rows} templates={templates.data ?? []} basePath="/manage/email" canManage={canManage} onToggle={(signal, enabled) => toggle(signal, "email", enabled)} />
    </div>;
}
