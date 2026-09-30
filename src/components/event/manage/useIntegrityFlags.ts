"use client";

import {useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {getIntegrityFlags} from "@/api/manageAnalyticsIntegrity";
import {emptyFlagIndex, indexFlags, integrityFlagsKey, type FlagIndex} from "./analytics/integrityModel";
import {useAnalyticsAccess} from "./analytics/useAnalyticsAccess";

// Unreviewed flagged solves for the attempts journal (docs/ANTI-CHEAT.md §5).
// Fetched once per journal view, and only for viewers with the sensitive
// analytics access; anyone else, and any failure, gets an empty index (no icons).
export function useIntegrityFlags(eventID: string): FlagIndex {
    const access = useAnalyticsAccess(eventID);
    const allowed = access.data?.Sensitive === true;
    const flags = useQuery({queryKey: integrityFlagsKey(eventID), queryFn: () => getIntegrityFlags(eventID), enabled: allowed, retry: false, refetchOnWindowFocus: false, refetchInterval: false, staleTime: 60_000});
    const data = allowed && !flags.isError ? flags.data : undefined;
    return useMemo(() => data ? indexFlags(data) : emptyFlagIndex(), [data]);
}
