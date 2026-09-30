"use client";

import {useQuery} from "@tanstack/react-query";
import {getParticipationStats, ParticipationStatsError} from "@/api/participationStats";
import type {ChartState} from "@/components/event/manage/analytics/analyticsModel";
import {isEmptyStats} from "./participationStatsModel";

const POLL_MS = 30_000;

// The caller's own results: one query shared by both tabs. The organizers' preview
// (`preview`) reads the real moderators team instead; `unavailable` means the event
// has no owner to lead it (409), so there is nothing to show. `notMember` (403) is staff outside the moderators team.
export function useParticipationStats(eventID: string | undefined, {preview, enabled}: {preview: boolean; enabled: boolean}) {
    const query = useQuery({
        queryKey: ["event-participation-stats", eventID, preview ? "moderators" : "own"], queryFn: () => getParticipationStats(eventID!, preview ? "moderators" : undefined),
        enabled: !!eventID && enabled, retry: false, refetchOnWindowFocus: false, refetchInterval: POLL_MS,
    });
    const stats = query.data;
    const state: ChartState = stats ? (isEmptyStats(stats) ? "empty" : "ready") : query.isError ? "error" : "loading";
    const unavailable = preview && query.error instanceof ParticipationStatsError && query.error.status === 409;
    // 403: read-only platform staff are not in the moderators team, so there is nothing to preview.
    const notMember = preview && query.error instanceof ParticipationStatsError && query.error.status === 403;
    return {stats, state, error: query.error, unavailable, notMember, retry: () => void query.refetch()};
}
