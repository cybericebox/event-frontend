import {requireApiOrigin} from "@/utils/origins";

// The server records one open per user and task per minute; asking more often
// only costs requests, so the same task is reported at most once per window.
export const TASK_OPENED_WINDOW_MS = 60_000;

const lastSent = new Map<string, number>();

// The task_opened beacon (docs/EVENT-ANALYTICS.md §11): fire and forget. It
// never throws and never delays the caller; a failure is dropped, because the
// analytics must not get in the way of solving a task.
export function reportTaskOpened(eventID: string, challengeID: string, now: number = Date.now()): void {
    const key = `${eventID}:${challengeID}`;
    const previous = lastSent.get(key);
    if (previous !== undefined && now - previous < TASK_OPENED_WINDOW_MS) return;
    lastSent.set(key, now);
    try {
        const api = requireApiOrigin();
        void fetch(`${api}/api/events/${encodeURIComponent(eventID)}/teams/challenges/${encodeURIComponent(challengeID)}/open`, {
            method: "POST", credentials: "include", cache: "no-store", keepalive: true,
        }).catch(() => {});
    } catch {
        // No API origin configured: nothing to report to.
    }
}

// Test hook: forget what was sent.
export function resetTaskOpenedBeacon(): void {
    lastSent.clear();
}
