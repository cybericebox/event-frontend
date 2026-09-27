"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageContent} from "@/api/manage";
import {usePrivateEvent} from "@/components/event/PrivateEventBootstrap";
import {ContentBlocks} from "./ContentBlocks";
import {EventLoading} from "../EventLoading";

export function PrivateLanding() {
    const event = usePrivateEvent();
    const content = useQuery({
        queryKey: ["event-management-content", event?.EventID],
        queryFn: () => getManageContent(event!.EventID),
        enabled: !!event,
        retry: false,
    });

    if (!event || content.isPending) return <EventLoading event={event} label="Завантажуємо головну сторінку…" />;
    if (content.isError) return <div className="event-shell-state" role="alert">
        <h1>Не вдалося завантажити головну сторінку</h1>
        <button className="ib-btn" onClick={() => void content.refetch()}>Повторити</button>
    </div>;
    return <div className="event-landing ib-blocks">
        {content.data.Landing.blocks.length > 0 && !content.data.Landing.blocks.some(block => block.type === "hero") && <h1 className="ib-visually-hidden">{event.Name}</h1>}
        <ContentBlocks document={content.data.Landing} variables={content.data.Variables} coverImage={event.PreviewPicture} />
    </div>;
}
