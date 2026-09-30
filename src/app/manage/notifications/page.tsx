"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageInAppTemplates} from "@/api/manageNotifications";
import {getManageNotificationSubscriptions, channelSignals} from "@/api/manageNotifications";
import {useManager} from "@/components/event/manage/ManagerShell";
import {TemplateList} from "@/components/event/manage/notifications/TemplateList";
import {useSubscriptionToggle} from "@/components/event/manage/notifications/useSubscriptionToggle";
import {t} from "@/i18n/t";

// «На сайті»: the in-app notifications of the event, like admin's template list.
export default function ManageNotificationsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-in-app-templates", eventID], queryFn: () => getManageInAppTemplates(eventID), refetchOnWindowFocus: false});
    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "in_app");

    const toggle = useSubscriptionToggle(eventID, canManage, {success: t("manage.notifications.showUpdated"), failure: t("manage.notifications.showError")});

    const state = subscriptions.isPending || templates.isPending ? "loading" : subscriptions.isError || templates.isError ? "error" : "ready";
    return <div className="event-manage-settings event-journal">
        <header className="event-manage-heading"><div><h1>{t("manage.notifications.title")}</h1><p>{t("manage.notifications.intro")}</p></div></header>
        <TemplateList event={event} state={state} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} error={subscriptions.error ?? templates.error} loadingLabel={t("manage.notifications.loading")} errorMessage={t("manage.notifications.loadError")} emptyMessage={t("manage.notifications.none")}
            signals={channelSignals(rows, "in_app")} rows={rows} templates={templates.data ?? []} basePath="/manage/notifications" canManage={canManage} onToggle={(signal, enabled) => toggle(signal, "in_app", enabled)} />
    </div>;
}
