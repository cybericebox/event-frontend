"use client";

import {useQuery} from "@tanstack/react-query";
import {broadcastTemplatesKey, getBroadcastTemplates} from "@/api/manageBroadcastTemplates";
import {getManageEmailTemplates} from "@/api/manageEmailTemplates";
import {getManageInAppTemplates} from "@/api/manageNotifications";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {broadcastTemplates, savedBroadcastTemplates, type BroadcastTemplate} from "./broadcastTemplates";

// «Шаблон»: the event's saved broadcast templates first, then the published notification templates. Picking one
// hands it to the composer, which fills itself from it; the template itself does not change.
export function TemplateStart({event, onPick}: {event: PublicEventInfo; onPick: (template: BroadcastTemplate) => void}) {
    const eventID = event.EventID;
    const saved = useQuery({queryKey: broadcastTemplatesKey(eventID), queryFn: () => getBroadcastTemplates(eventID), refetchOnWindowFocus: false, placeholderData: previous => previous});
    const emails = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const inApps = useQuery({queryKey: ["event-manage-inapp-templates", eventID], queryFn: () => getManageInAppTemplates(eventID), refetchOnWindowFocus: false});
    const failed = saved.isError || emails.isError || inApps.isError;
    const loaded = !!saved.data && !!emails.data && !!inApps.data;
    const templates = loaded ? [
        ...savedBroadcastTemplates(saved.data!).map(template => ({...template, group: t("manage.broadcasts.template.groupSaved")})),
        ...broadcastTemplates(emails.data!, inApps.data!).map(template => ({...template, group: t("manage.broadcasts.template.groupSignals")})),
    ] : [];
    const retry = () => {void saved.refetch(); void emails.refetch(); void inApps.refetch();};

    return <div className="event-manage-field event-broadcast-template">
        <ManageFieldLabel title={t("manage.broadcasts.template.start")} help={t("manage.broadcasts.template.help")} />
        {failed ? <EventLoadError compact message={t("manage.broadcasts.template.loadError")} onRetry={retry} error={saved.error ?? emails.error ?? inApps.error} />
            : !loaded ? <div className="event-broadcast-template__loading"><EventBrandLogo event={event} className="event-loading-logo" size={16} /></div>
            : <EventSelect value="" onValueChange={type => {const found = templates.find(template => template.type === type); if (found) onPick(found);}}
                ariaLabel={t("manage.broadcasts.template.start")} placeholder={t(templates.length === 0 ? "manage.broadcasts.template.none" : "manage.broadcasts.template.placeholder")} disabled={templates.length === 0}
                options={templates.map(template => ({value: template.type, label: template.label, group: template.group}))} />}
    </div>;
}
