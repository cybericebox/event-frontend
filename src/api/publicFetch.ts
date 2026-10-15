import {serverGet} from "./serverGet";

// A server render waits on these reads; a hung API must end in the error or outage
// state instead of streaming the route loader forever.
export const SERVER_FETCH_TIMEOUT_MS = 10_000;

export type PublicResponse = {status: number; body: unknown; requestId?: string};

// One fetch per key at a time per replica: concurrent renders of the same event wait for the same request, so a
// burst of visitors on a cold or expired cache costs the API one call, not one per visitor.
const inflight = new Map<string, Promise<PublicResponse>>();

// Legacy reads never use Next stale-while-revalidate: a cached 200 must not survive a later 404.
export function fetchPublic(url: string, headers: Record<string, string>): Promise<PublicResponse> {
    const key = `${headers.Origin ?? ""} ${url}`;
    const running = inflight.get(key);
    if (running) return running;
    if (inflight.size >= 64) return Promise.reject(new Error("Public fetch busy"));
    const request = (async (): Promise<PublicResponse> => {
        const response = await serverGet(url, headers, AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS));
        if (!response.ok) {
            // A 5xx that carries X-Request-ID came from our backend (it journaled the error); one without is a proxy answer.
            const requestId = response.status >= 500 ? response.headers.get("X-Request-ID") : null;
            return requestId ? {status: response.status, body: null, requestId} : {status: response.status, body: null};
        }
        // An answer without a JSON body (the page access check) is still a success.
        const text = await response.text();
        let body: unknown = null;
        if (text) {
            try { body = JSON.parse(text); } catch { /* Keep the status; the caller validates the body it needs. */ }
        }
        return {status: response.status, body};
    })().finally(() => { inflight.delete(key); });
    inflight.set(key, request);
    return request;
}
