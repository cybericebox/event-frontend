"use client";

import {useEffect} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageResults, resultsLiveURL, type ManageResultsSnapshot} from "@/api/manageResults";
import {getLiveScreenResultsByLink, liveScreenResultsStreamURL} from "@/api/manageLive";
import {useEventStream} from "@/utils/eventStream";
import {nextFreezeBoundary} from "@/utils/resultsFreeze";

// Live-screen results (the staff board, view=live): a snapshot reloaded on
// every SSE change, snapshot-required reopens the stream from a fresh
// snapshot, and polling only while the stream keeps failing. A screen link
// (`token`) reads the same board through the link endpoints, without a
// session. `refreshSeconds` (the layout setting, 2–30 s) is the stream's
// server poll and the fallback poll.
export function useLiveResults(eventID: string, enabled = true, {token, refreshSeconds = 10}: {token?: string; refreshSeconds?: number} = {}) {
    const queryClient = useQueryClient();
    const queryKey = ["event-live-results", eventID, token ? "link" : "staff"];
    const revision = queryClient.getQueryData<ManageResultsSnapshot>(queryKey)?.Revision;
    const stream = useEventStream({
        url: () => {
            if (revision === undefined) return null;
            if (token) return liveScreenResultsStreamURL(token, revision, refreshSeconds);
            const url = resultsLiveURL(eventID, revision, "live");
            return url && `${url}&pollInterval=${refreshSeconds}`;
        },
        events: ["result-change"], resetEvents: ["snapshot-required"],
        onChange: () => void queryClient.invalidateQueries({queryKey}),
        enabled: enabled && revision !== undefined,
    });
    const results = useQuery({
        queryKey, queryFn: () => token ? getLiveScreenResultsByLink(token) : getManageResults(eventID, "live"), enabled, retry: false,
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
