"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageContent} from "@/api/manage";
import {usePrivateEvent} from "@/components/event/PrivateEventBootstrap";
import {ContentBlocks} from "./ContentBlocks";
import {LandingHero} from "./LandingHero";

export function PrivateLanding() {
    const event = usePrivateEvent();
    const content = useQuery({
        queryKey: ["event-manager-content", event?.EventID],
        queryFn: () => getManageContent(event!.EventID),
        enabled: !!event,
        retry: false,
    });

    if (!event || content.isPending) return <div className="event-shell-state" role="status">Завантажуємо головну сторінку…</div>;
    if (content.isError) return <div className="event-shell-state" role="alert">
        <h1>Не вдалося завантажити головну сторінку</h1>
        <button className="ib-btn" onClick={() => void content.refetch()}>Повторити</button>
    </div>;
    return <div className="event-landing ib-blocks">
        <LandingHero event={event} preview />
        <ContentBlocks document={content.data.Landing} variables={content.data.Variables} />
    </div>;
}
