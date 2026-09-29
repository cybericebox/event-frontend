"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageEmailTemplates} from "@/api/manageEmailTemplates";
import {getManageNotificationSubscriptions, putManageNotificationSubscription, channelSignals} from "@/api/manageNotifications";
import {useManager} from "@/components/event/manage/ManagerShell";
import {TemplateList} from "@/components/event/manage/notifications/TemplateList";
import {t} from "@/i18n/t";

// «Електронні листи»: the emails of the event, like admin's template list.
export default function ManageEmailPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const [busy, setBusy] = useState(false);
    const rows = (subscriptions.data ?? []).filter(row => row.Channel === "email");

    async function toggle(signal: string, enabled: boolean) {
        const row = rows.find(item => item.SignalType === signal);
        if (!row || busy || !canManage) return;
        setBusy(true);
        try {
            await putManageNotificationSubscription(eventID, {SignalType: row.SignalType, Channel: row.Channel, Enabled: enabled, Audience: row.Audience});
            await queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]});
            toast.success(t("manage.email.sendUpdated"));
        } catch {toast.error(t("manage.email.sendError"));}
        finally {setBusy(false);}
    }

    const state = subscriptions.isPending || templates.isPending ? "loading" : subscriptions.isError || templates.isError ? "error" : "ready";
    return <div className="event-manage-settings event-journal">
        <header className="event-manage-heading"><div><h1>{t("manage.email.title")}</h1><p>{t("manage.email.intro")}</p></div></header>
        <TemplateList event={event} state={state} onRetry={() => {void subscriptions.refetch(); void templates.refetch();}} loadingLabel={t("manage.email.loading")} errorMessage={t("manage.email.loadError")} emptyMessage={t("manage.email.none")}
            signals={channelSignals(rows, "email")} rows={rows} templates={templates.data ?? []} basePath="/manage/email" canManage={canManage} busy={busy} onToggle={(signal, enabled) => void toggle(signal, enabled)} />
    </div>;
}
