"use client";

import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getParticipationStats, ParticipationStatsError} from "@/api/participationStats";
import type {ChartState} from "@/components/event/manage/analytics/analyticsModel";
import {isEmptyStats} from "./participationStatsModel";
import {useParticipantPreview} from "../ParticipantPreview";
import {getPreviewBoard, previewBoardKey} from "@/api/participantPreview";
import {previewProgress} from "./previewProgress";
import type {CurrentUser} from "@/api/clientAuth";
import {t} from "@/i18n/t";

const POLL_MS = 30_000;

// The caller's own results: one query shared by both tabs. The organizers' preview
// (`preview`) reads the real moderators team instead; `unavailable` means the event
// has no owner to lead it (409), so there is nothing to show. `notMember` (403) is staff outside the moderators team.
export function useParticipationStats(eventID: string | undefined, {preview, enabled}: {preview: boolean; enabled: boolean}) {
    const simulation = useParticipantPreview(eventID);
    const client = useQueryClient();
    const board = useQuery({queryKey: previewBoardKey(eventID), queryFn: () => getPreviewBoard(eventID!), enabled: simulation.active && !!eventID && enabled, retry: false, refetchOnWindowFocus: false, refetchInterval: POLL_MS});
    const query = useQuery({
        queryKey: ["event-participation-stats", eventID, preview ? "moderators" : "own"], queryFn: () => getParticipationStats(eventID!, preview ? "moderators" : undefined),
        enabled: !simulation.active && !!eventID && enabled, retry: false, refetchOnWindowFocus: false, refetchInterval: POLL_MS,
    });
    const currentUser = client.getQueryData<CurrentUser>(["event-current-user"]);
    const stats = simulation.active ? board.data && previewProgress(board.data.Challenges, {
        userID: simulation.state!.userID, name: [currentUser?.FirstName, currentUser?.LastName].filter(Boolean).join(" ") || t("participantPreview.you"),
        teamID: simulation.state?.team?.ID, teamName: simulation.state?.team?.Name,
    }) : query.data;
    const selected = simulation.active ? board : query;
    const state: ChartState = stats ? (isEmptyStats(stats) ? "empty" : "ready") : selected.isError ? "error" : "loading";
    const unavailable = !simulation.active && preview && query.error instanceof ParticipationStatsError && query.error.status === 409;
    // 403: read-only platform staff are not in the moderators team, so there is nothing to preview.
    const notMember = !simulation.active && preview && query.error instanceof ParticipationStatsError && query.error.status === 403;
    return {stats, state, error: selected.error, unavailable, notMember, retry: () => void selected.refetch()};
}
