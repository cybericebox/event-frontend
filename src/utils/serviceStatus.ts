import {isEventSelfRequest, reportEventNotFound} from "./eventGone";
import {apiOrigin} from "./origins";

// Backend reachability, shared by every browser API call. A network failure or a
// 5xx marks the service "suspect"; the gate confirms with two probes 15 s apart before it shows
// the outage modal ("down") and reports recovery ("up").
export type ServiceStatus = "up" | "suspect" | "down";

let status: ServiceStatus = "up";
const listeners = new Set<() => void>();
const restoredListeners = new Set<() => void>();

function emit() {
    listeners.forEach(listener => listener());
}

export function getServiceStatus(): ServiceStatus {
    return status;
}

export function isServiceDown(): boolean {
    return status !== "up";
}

export function reportServiceUnavailable(): void {
    if (status !== "up") return;
    status = "suspect";
    emit();
}

export function confirmServiceUnavailable(): void {
    if (status === "down") return;
    status = "down";
    emit();
}

export function reportServiceAvailable(): void {
    if (status === "up") return;
    status = "up";
    emit();
    restoredListeners.forEach(listener => listener());
}

export function subscribeServiceStatus(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function onServiceRestored(listener: () => void): () => void {
    restoredListeners.add(listener);
    return () => restoredListeners.delete(listener);
}

export function isUnavailableStatus(code: number): boolean {
    return code >= 500 && code <= 599;
}

function requestURL(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    return input.url;
}

// The API's Server-Sent Events endpoints. A stream ends and reconnects by design
// (server lifetime, proxy idle timeout), so its failures never mean an outage.
const STREAM_PATH = /\/(?:results|solution-attempts)\/live(?:[?#]|$)/;

export function isStreamRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
    if (STREAM_PATH.test(requestURL(input))) return true;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    return headers.get("Accept")?.includes("text/event-stream") ?? false;
}

// Requests cut by leaving the page fail like a network error; they are not outages.
let leaving = false;

// A failed request that may mean the API is unreachable: not one the caller
// aborted or timed out, and not one cut by the page unloading.
export function isNetworkOutage(error: unknown, signal?: AbortSignal | null): boolean {
    if (leaving || signal?.aborted) return false;
    return !(error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"));
}

// Wraps fetch so every call to the API feeds the status store. Only normal API
// calls count: streams, aborted requests and 4xx answers are not outages. A 404 of an event
// call is passed on to the event-gone check.
export function trackApiFetch(fetchImpl: typeof fetch, origin = apiOrigin): typeof fetch {
    return async (input, init) => {
        if (!origin || !requestURL(input).startsWith(origin) || isStreamRequest(input, init)) return fetchImpl(input, init);
        try {
            const response = await fetchImpl(input, init);
            const stream = response.headers.get("Content-Type")?.includes("text/event-stream") ?? false;
            if (!stream && isUnavailableStatus(response.status)) reportServiceUnavailable();
            if (response.status === 404 && isEventSelfRequest(requestURL(input), origin)) void reportEventNotFound(origin, fetchImpl);
            return response;
        } catch (error) {
            if (isNetworkOutage(error, init?.signal ?? (input instanceof Request ? input.signal : null))) reportServiceUnavailable();
            throw error;
        }
    };
}

// Short backend restarts must not flash the modal: after the first failure the
// gate waits, probes, waits again and probes again; only when every probe fails
// (about 30 s in all) does the outage show.
export const OUTAGE_GRACE_MS = 15_000;
export const OUTAGE_GRACE_PROBES = 2;

// Runs the grace period for a "suspect" status: one probe per OUTAGE_GRACE_MS, a
// success reports the API as available, and only the last failed probe confirms
// the outage. Returns a cancel function.
export function startOutageGrace(probe: () => Promise<boolean>): () => void {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = (left: number) => {
        timer = setTimeout(async () => {
            const ok = await probe();
            if (cancelled) return;
            if (ok) reportServiceAvailable();
            else if (left > 1) step(left - 1);
            else confirmServiceUnavailable();
        }, OUTAGE_GRACE_MS);
    };
    step(OUTAGE_GRACE_PROBES);
    return () => {
        cancelled = true;
        clearTimeout(timer);
    };
}

// Long enough for a slow answer over a busy connection; a hung API still fails.
const PROBE_TIMEOUT_MS = 10_000;

// The recovery probe: session validation answers below 500 for everyone (200
// signed in, 401 anonymous) once the API and its storage respond. It goes to the
// API origin like every other call.
export async function probeService(origin = apiOrigin): Promise<boolean> {
    if (!origin) return false;
    try {
        const response = await fetch(`${origin}/api/auth/me`, {
            credentials: "include", cache: "no-store", headers: {Accept: "application/json"}, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        return !isUnavailableStatus(response.status);
    } catch {
        return false;
    }
}

let tracking = false;

// The API calls live in many modules with plain fetch; one wrapper installed in the
// browser covers all of them.
export function installServiceStatusTracking(): void {
    if (tracking || typeof window === "undefined") return;
    tracking = true;
    window.addEventListener("pagehide", () => { leaving = true; });
    window.addEventListener("pageshow", () => { leaving = false; });
    window.fetch = trackApiFetch(window.fetch.bind(window));
}

// A failed request that means the API is unreachable: fetch rejects with a
// TypeError on network failure; a 5xx carries its status. Only while the store
// holds the failure, so a TypeError from a bug is not taken for an outage.
export function isOutageError(error: unknown, code: number): boolean {
    return isServiceDown() && (error instanceof TypeError || isUnavailableStatus(code));
}
