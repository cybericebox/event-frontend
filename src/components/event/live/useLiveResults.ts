"use client";

import {useEffect} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageResults, resultsLiveURL, type ManageResultsSnapshot} from "@/api/manageResults";
import {useEventStream} from "@/utils/eventStream";
import {nextFreezeBoundary} from "@/utils/resultsFreeze";

// Live-screen results (view=live): a snapshot reloaded on every SSE change,
// snapshot-required reopens the stream from a fresh snapshot, and 10 s
// polling only while the stream keeps failing.
export function useLiveResults(eventID: string, enabled = true) {
    const queryClient = useQueryClient();
    const queryKey = ["event-live-results", eventID];
    const revision = queryClient.getQueryData<ManageResultsSnapshot>(queryKey)?.Revision;
    const stream = useEventStream({
        url: () => revision === undefined ? null : resultsLiveURL(eventID, revision, "live"),
        events: ["result-change"], resetEvents: ["snapshot-required"],
        onChange: () => void queryClient.invalidateQueries({queryKey}),
        enabled: enabled && revision !== undefined,
    });
    const results = useQuery({
        queryKey, queryFn: () => getManageResults(eventID, "live"), enabled, retry: false,
        refetchInterval: stream === "fallback" ? 10000 : false,
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
