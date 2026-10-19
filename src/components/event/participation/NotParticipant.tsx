"use client";

import {useQuery} from "@tanstack/react-query";
import {getJoinStatus} from "@/api/clientAuth";
import {ParticipationStatusEnum} from "@/types/event";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {JoinLink} from "@/components/event/join/JoinLink";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";

// A signed-in visitor who is not a participant of the event yet. Only one who may still apply gets
// «Приєднатися»; an application under review or a rejected one is named as it is, without a button
// that would lead back to the same answer.
export function NotParticipant({eventID, message, action}: {eventID: string; message: string; action: string}) {
    const status = useQuery({queryKey: ["event-join-status", eventID], queryFn: getJoinStatus, retry: false});
    if (status.isPending) return <EventLoading label={t("participation.loading")} />;
    if (status.isError) return <EventLoadError message={t("join.loadFailed")} error={status.error} onRetry={() => void status.refetch()} />;
    if (status.data === ParticipationStatusEnum.PendingParticipationStatus) return <EmptyState message={t("shell.join.pending")} />;
    if (status.data === ParticipationStatusEnum.RejectedParticipationStatus) return <EmptyState message={t("shell.join.rejected")} />;
    return <EmptyState message={message} action={<JoinLink eventID={eventID}>{action}</JoinLink>} />;
}
