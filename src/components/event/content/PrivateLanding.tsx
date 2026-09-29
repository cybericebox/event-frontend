"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageContent} from "@/api/manage";
import {usePrivateEvent} from "@/components/event/PrivateEventBootstrap";
import {ContentBlocks} from "./ContentBlocks";
import {EventLoading} from "../EventLoading";
import {t} from "@/i18n/t";

export function PrivateLanding() {
    const event = usePrivateEvent();
    const content = useQuery({
        queryKey: ["event-management-content", event?.EventID],
        queryFn: () => getManageContent(event!.EventID),
        enabled: !!event,
        retry: false,
    });

    if (!event || content.isPending) return <EventLoading event={event} label={t("content.landing.loading")} />;
    if (content.isError) return <div className="event-shell-state" role="alert">
        <h1>{t("content.landing.failed")}</h1>
        <button className="ib-btn" onClick={() => void content.refetch()}>{t("common.retry")}</button>
    </div>;
    return <div className="event-landing ib-blocks">
        <ContentBlocks document={content.data.Landing} variables={content.data.Variables} title={event.Name} coverImage={event.PreviewPicture} eventID={event.EventID} />
    </div>;
}
