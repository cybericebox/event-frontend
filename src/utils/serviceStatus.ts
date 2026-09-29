import {apiOrigin} from "./origins";

// Backend reachability, shared by every browser API call. A network failure or a
// 5xx marks the service "suspect"; the gate confirms with a probe before it shows
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

// Wraps fetch so every call to the API feeds the status store. Only API calls
// count; aborted requests are not outages.
export function trackApiFetch(fetchImpl: typeof fetch, origin = apiOrigin): typeof fetch {
    return async (input, init) => {
        if (!origin || !requestURL(input).startsWith(origin)) return fetchImpl(input, init);
        try {
            const response = await fetchImpl(input, init);
            if (isUnavailableStatus(response.status)) reportServiceUnavailable();
            return response;
        } catch (error) {
            const aborted = init?.signal?.aborted || (error instanceof DOMException && error.name === "AbortError");
            if (!aborted) reportServiceUnavailable();
            throw error;
        }
    };
}

let tracking = false;

// The API calls live in many modules with plain fetch; one wrapper installed in the
// browser covers all of them.
export function installServiceStatusTracking(): void {
    if (tracking || typeof window === "undefined") return;
    tracking = true;
    window.fetch = trackApiFetch(window.fetch.bind(window));
}

// A failed request that means the API is unreachable: fetch rejects with a
// TypeError on network failure; a 5xx carries its status.
export function isOutageError(error: unknown, code: number): boolean {
    return error instanceof TypeError || isUnavailableStatus(code);
}
