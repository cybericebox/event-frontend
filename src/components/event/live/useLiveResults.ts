"use client";

import {useEffect} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageResults, resultsLiveURL, type ManageResultsSnapshot, type ResultsView} from "@/api/manageResults";
import {useEventStream} from "@/utils/eventStream";
import {nextFreezeBoundary} from "@/utils/resultsFreeze";

// Live-screen results: a snapshot reloaded on every SSE change,
// snapshot-required reopens the stream from a fresh snapshot, and polling
// only while the stream keeps failing. Managers read view=live; other
// viewers read the same board as the results page. `refreshSeconds` (the
// layout setting, 2–30 s) is the stream's server poll and the fallback poll.
export function useLiveResults(eventID: string, enabled = true, {view = "live", refreshSeconds = 10}: {view?: ResultsView; refreshSeconds?: number} = {}) {
    const queryClient = useQueryClient();
    const queryKey = ["event-live-results", eventID, view];
    const revision = queryClient.getQueryData<ManageResultsSnapshot>(queryKey)?.Revision;
    const stream = useEventStream({
        url: () => {
            const url = revision === undefined ? null : resultsLiveURL(eventID, revision, view);
            return url && `${url}&pollInterval=${refreshSeconds}`;
        },
        events: ["result-change"], resetEvents: ["snapshot-required"],
        onChange: () => void queryClient.invalidateQueries({queryKey}),
        enabled: enabled && revision !== undefined,
    });
    const results = useQuery({
        queryKey, queryFn: () => getManageResults(eventID, view), enabled, retry: false,
        refetchInterval: stream === "fallback" ? refreshSeconds * 1000 : false,
    });
    // The freeze starts and ends by the clock: reload right after each boundary.
    const freeze = results.data?.Freeze;
    const refetch = results.refetch;
    useEffect(() => {
        if (!freeze) return;
        const delay = nextFreezeBoundary(freeze, Date.now());
        if (delay === null || delay > 2_147_000_000) return;
        const id = setTimeout(() => void refetch(), delay + 1000);
        return () => clearTimeout(id);
    }, [freeze, refetch]);
    return {results, stream};
}
