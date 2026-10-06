"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageEmailTemplates} from "@/api/manageEmailTemplates";
import {getManageInAppTemplates} from "@/api/manageNotifications";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {broadcastTemplates, type BroadcastTemplate} from "./broadcastTemplates";

// «Почати з шаблону»: picking a published template hands it to the composer, which prefills itself from it.
export function TemplateStart({event, onPick}: {event: PublicEventInfo; onPick: (template: BroadcastTemplate) => void}) {
    const eventID = event.EventID;
    const emails = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const inApps = useQuery({queryKey: ["event-manage-inapp-templates", eventID], queryFn: () => getManageInAppTemplates(eventID), refetchOnWindowFocus: false});
    const failed = emails.isError || inApps.isError;
    const templates = emails.data && inApps.data ? broadcastTemplates(emails.data, inApps.data) : [];
    const retry = () => {void emails.refetch(); void inApps.refetch();};

    return <div className="event-manage-field event-broadcast-template">
        <ManageFieldLabel title={t("manage.broadcasts.template.start")} help={t("manage.broadcasts.template.help")} />
        {failed ? <EventLoadError compact message={t("manage.broadcasts.template.loadError")} onRetry={retry} error={emails.error ?? inApps.error} />
            : !emails.data || !inApps.data ? <div className="event-broadcast-template__loading"><EventBrandLogo event={event} className="event-loading-logo" size={16} /></div>
            : <EventSelect value="" onValueChange={type => {const found = templates.find(template => template.type === type); if (found) onPick(found);}}
                ariaLabel={t("manage.broadcasts.template.start")} placeholder={t(templates.length === 0 ? "manage.broadcasts.template.none" : "manage.broadcasts.template.placeholder")} disabled={templates.length === 0}
                options={templates.map(template => ({value: template.type, label: template.label}))} />}
    </div>;
}
