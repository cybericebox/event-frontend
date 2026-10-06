"use client";

import {useRef} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {putManageNotificationSubscription, type ManageNotificationSubscription} from "@/api/manageNotifications";

// The on/off switch of sending a signal. It flips at once in the cache; the
// saves run one after another, and no control waits for them. The server answer
// is applied only if it differs and no newer change waits; on error the list
// is refetched and a toast shows.
export function useSubscriptionToggle(eventID: string, canManage: boolean, messages: {success: string; failure: string}) {
    const queryClient = useQueryClient();
    const queue = useRef<Promise<void>>(Promise.resolve());
    const pending = useRef(0);
    const key = ["event-manage-notification-subscriptions", eventID];

    return function toggle(signal: string, channel: ManageNotificationSubscription["Channel"], enabled: boolean) {
        if (!canManage) return;
        const rows = queryClient.getQueryData<ManageNotificationSubscription[]>(key);
        const row = rows?.find(item => item.SignalType === signal && item.Channel === channel);
        if (!row || row.Required) return;
        const patch = (rowsNow: ManageNotificationSubscription[] | undefined, next: Partial<ManageNotificationSubscription>) =>
            rowsNow?.map(item => item.SignalType === signal && item.Channel === channel ? {...item, ...next} : item);
        queryClient.setQueryData<ManageNotificationSubscription[]>(key, current => patch(current, {Enabled: enabled}));
        pending.current += 1;
        queue.current = queue.current.then(async () => {
            try {
                const saved = await putManageNotificationSubscription(eventID, {SignalType: signal, Channel: channel, Enabled: enabled, Audience: row.Audience});
                pending.current -= 1;
                const shown = queryClient.getQueryData<ManageNotificationSubscription[]>(key)?.find(item => item.SignalType === signal && item.Channel === channel);
                // Apply the answer only when no newer change waits and it differs from what is shown.
                if (pending.current === 0 && shown && JSON.stringify(saved) !== JSON.stringify(shown)) queryClient.setQueryData<ManageNotificationSubscription[]>(key, current => patch(current, saved));
                toast.success(messages.success);
            } catch {
                pending.current -= 1;
                if (pending.current === 0) await queryClient.invalidateQueries({queryKey: key});
                toast.error(messages.failure);
            }
        });
    };
}
