"use client";

import {useQuery} from "@tanstack/react-query";
import {getAnalyticsAccess} from "@/api/manageAnalytics";

// What the viewer may see of this event's analytics (§7). Shared by the sidebar
// and the pages through one query key.
export const analyticsAccessKey = (eventID: string) => ["event-analytics-access", eventID] as const;

export function useAnalyticsAccess(eventID: string, enabled = true) {
    return useQuery({
        queryKey: analyticsAccessKey(eventID),
        queryFn: () => getAnalyticsAccess(eventID),
        enabled, retry: false, refetchInterval: false, refetchOnWindowFocus: false,
    });
}
