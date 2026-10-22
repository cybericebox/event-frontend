"use client";

import {useState} from "react";
import {keepPreviousData, useQuery, useQueryClient} from "@tanstack/react-query";
import {getLiveScreenEditor, getLiveScreens} from "@/api/manageLive";
import {LiveEditor} from "@/components/event/live/editor/LiveEditor";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";

// The live screens of the event: the editor shows one of them, the select in
// its header switches. The open screen is kept in ?screen=, so a reload stays on it.
function screenFromURL(): string | null {
    return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("screen");
}

export default function ManageLivePage() {
    const {event, canManage} = useManager();
    const queryClient = useQueryClient();
    const [chosen, setChosen] = useState<string | null>(screenFromURL);
    const screens = useQuery({queryKey: ["event-live-screens", event.EventID], queryFn: () => getLiveScreens(event.EventID), refetchOnWindowFocus: false, placeholderData: keepPreviousData});
    const list = screens.data?.Screens ?? [];
    const screenID = (chosen && list.some(screen => screen.ID === chosen) ? chosen : list[0]?.ID) ?? null;
    const editor = useQuery({queryKey: ["event-live-editor", event.EventID, screenID], queryFn: () => getLiveScreenEditor(event.EventID, screenID!), enabled: !!screenID, refetchOnWindowFocus: false,
        // While another screen loads, the open one stays on the page (no loader after the first load).
        placeholderData: keepPreviousData});
    function open(next: string) {
        setChosen(next);
        const url = new URL(window.location.href);
        url.searchParams.set("screen", next);
        window.history.replaceState(window.history.state, "", url);
    }
    if (screens.isError) return <EventLoadError message={t("manage.live.loadError")} error={screens.error} onRetry={() => void screens.refetch()} />;
    if (editor.isError) return <EventLoadError message={t("manage.live.loadError")} error={editor.error} onRetry={() => void editor.refetch()} />;
    if (!screens.data || !screenID || !editor.data) return <EventLoading event={event} label={t("manage.live.loading")} />;
    // The editor shows the screen its data belongs to.
    const shownID = editor.data.ID;
    return <LiveEditor key={`${event.EventID}:${shownID}`} event={event} canManage={canManage} data={editor.data} screenID={shownID} screens={screens.data}
        onScreenSwitch={open}
        onScreensChanged={select => {
            void queryClient.invalidateQueries({queryKey: ["event-live-screens", event.EventID], exact: true});
            if (select) open(select);
        }} />;
}
