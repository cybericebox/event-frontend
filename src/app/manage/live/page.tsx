"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageLive} from "@/api/manageLive";
import {LiveEditor} from "@/components/event/live/editor/LiveEditor";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";

export default function ManageLivePage() {
    const {event, canManage} = useManager();
    const editor = useQuery({queryKey: ["event-live-editor", event.EventID], queryFn: () => getManageLive(event.EventID), refetchOnWindowFocus: false});
    if (editor.isError) return <EventLoadError message={t("manage.live.loadError")} error={editor.error} onRetry={() => void editor.refetch()} />;
    if (editor.isPending) return <EventLoading event={event} label={t("manage.live.loading")} />;
    return <LiveEditor key={event.EventID} event={event} canManage={canManage} data={editor.data} />;
}

