"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getParticipationStats, type ParticipationStats} from "@/api/participationStats";
import type {ChartState} from "@/components/event/manage/analytics/analyticsModel";
import {previewStats} from "./participationPreview";
import {isEmptyStats} from "./participationStatsModel";

const POLL_MS = 30_000;

// The caller's own results: one query shared by both tabs. The organizers' preview gets made-up data and no request.
export function useParticipationStats(eventID: string | undefined, {preview, enabled}: {preview: boolean; enabled: boolean}) {
    const query = useQuery({
        queryKey: ["event-participation-stats", eventID], queryFn: () => getParticipationStats(eventID!),
        enabled: !!eventID && enabled && !preview, retry: false, refetchOnWindowFocus: false, refetchInterval: POLL_MS,
    });
    const [sample] = useState(() => preview ? previewStats(Date.now()) : undefined);
    const stats: ParticipationStats | undefined = sample ?? query.data;
    const state: ChartState = stats ? (isEmptyStats(stats) ? "empty" : "ready") : query.isError ? "error" : "loading";
    return {stats, state, error: query.error, retry: () => void query.refetch()};
}
