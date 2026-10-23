"use client";

import Link from "next/link";
import {CircleHelp, Plus} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {broadcastTemplatesKey, getBroadcastTemplates} from "@/api/manageBroadcastTemplates";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

// The custom templates of one channel for a templates page: the event's saved broadcast messages that send on it.
export function useCustomTemplates(eventID: string, channel: "email" | "in_app") {
    const query = useQuery({queryKey: broadcastTemplatesKey(eventID), queryFn: () => getBroadcastTemplates(eventID), refetchOnWindowFocus: false, placeholderData: previous => previous});
    return {query, rows: (query.data ?? []).filter(item => item.Channels.includes(channel))};
}

// «Створити шаблон» of a templates page: a new custom template (triggered templates come with the platform's actions).
export function CustomTemplateCreate({basePath, canManage}: {basePath: string; canManage: boolean}) {
    if (canManage) return <Link className="ib-btn ib-btn--primary" href={`${basePath}/custom/new`}><Plus size={15} aria-hidden="true" /> {t("manage.customTemplates.create")}</Link>;
    return <span className="event-broadcast-heading-actions">
        <button className="ib-btn ib-btn--primary" type="button" disabled><Plus size={15} aria-hidden="true" /> {t("manage.customTemplates.create")}</button>
        <EventTooltip help content={t("manage.customTemplates.viewerCannotEdit")}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.customTemplates.viewerCannotEditLabel")} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
    </span>;
}
