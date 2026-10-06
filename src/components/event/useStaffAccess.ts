"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageAccess} from "@/api/manage";
import {getCurrentUser} from "@/api/clientAuth";

// Whether the signed-in viewer is on the event's staff. Shares the query keys
// of the navbar, so the site asks once.
export function useStaffAccess(eventID: string | undefined, enabled = true): {staff: boolean; pending: boolean} {
    const user = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false, enabled});
    const access = useQuery({
        queryKey: ["event-management-access", eventID], queryFn: () => getManageAccess(eventID!),
        enabled: enabled && !!eventID && !!user.data, retry: false, refetchOnWindowFocus: false,
    });
    return {staff: !!access.data, pending: enabled && user.isPending || (!!user.data && !!eventID && access.isPending)};
}
