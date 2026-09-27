"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageResults} from "@/api/manageResults";
import {getPublishedLiveLayout, type LiveLayout} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "./LiveCanvas";
import type {CSSProperties} from "react";

export function LiveScreen({event, layout}: {event: PublicEventInfo; layout: LiveLayout}) {
    const results = useQuery({queryKey: ["event-live-screen-results", event.EventID], queryFn: () => getManageResults(event.EventID), retry: false, refetchInterval: 10000});
    const published = useQuery({queryKey: ["event-live-screen-layout", event.EventID], queryFn: () => getPublishedLiveLayout(event.EventID), retry: false, refetchInterval: 15000, initialData: layout});
    const active = published.data ?? layout;
    const style = {"--live-screen-width": `${active.screen.width}px`, "--live-screen-height": `${active.screen.height}px`} as CSSProperties;
    return <main className={`live-fullscreen${active.screen.anchor === "top-left" ? " live-fullscreen--anchor" : ""}`} style={style}>
        <LiveCanvas layout={active} event={event} results={results.data} />
        {results.isError && <div className="live-fullscreen__notice" role="alert">Дані результатів тимчасово недоступні</div>}
    </main>;
}
