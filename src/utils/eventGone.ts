import {apiOrigin} from "./origins";

// The event of an open site disappears (deleted) while the page is loaded. The API answers
// 404 to every call of that event, so a 404 from an event-scoped call is checked once against
// the event's own public info (with the session: a manager still reads an unpublished one).
// Still 404 → the event is gone and the shell shows the not-found screen. Any other answer,
// a network failure or a 5xx is not that: other errors keep their own handling.
let gone = false;
let checking = false;
const listeners = new Set<() => void>();

const SELF_PATH = "/api/events/self/";
const PUBLIC_INFO_PATH = "/api/events/self/public-info";

export function isEventGone(): boolean {
    return gone;
}

export function subscribeEventGone(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// A 404 of a call that targets «this event» (not the public-info read the check itself makes).
export function isEventSelfRequest(url: string, origin = apiOrigin): boolean {
    if (!origin || !url.startsWith(origin)) return false;
    const path = url.slice(origin.length);
    return path.startsWith(SELF_PATH) && !path.startsWith(PUBLIC_INFO_PATH);
}

export async function reportEventNotFound(origin = apiOrigin, fetchImpl: typeof fetch = window.fetch.bind(window)): Promise<void> {
    if (gone || checking || !origin) return;
    checking = true;
    try {
        const response = await fetchImpl(`${origin}${PUBLIC_INFO_PATH}`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
        if (response.status !== 404) return;
        gone = true;
        listeners.forEach(listener => listener());
    } catch {
        // unreachable API is the outage gate's business
    } finally {
        checking = false;
    }
}

export function resetEventGone(): void {
    gone = false;
    checking = false;
}
