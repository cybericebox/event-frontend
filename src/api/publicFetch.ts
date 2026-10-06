// A server render waits on these reads; a hung API must end in the error or outage
// state instead of streaming the route loader forever.
export const SERVER_FETCH_TIMEOUT_MS = 10_000;

// How long a replica serves a public event read from its fetch cache. After it the next request still gets the
// cached copy (stale-while-revalidate) and the replica refreshes it in the background. There is no invalidation
// on save: the server cannot know how many replicas there are, so a change shows within this time.
export const PUBLIC_REVALIDATE_SECONDS = 30;

export type PublicResponse = {status: number; body: unknown; requestId?: string};

// One fetch per key at a time per replica: concurrent renders of the same event wait for the same request, so a
// burst of visitors on a cold or expired cache costs the API one call, not one per visitor.
const inflight = new Map<string, Promise<PublicResponse>>();

// Reads one public URL of the API with the 30 s stale-while-revalidate fetch cache. The event host travels as
// Origin (the API resolves its tenant from it) and is part of the cache key. Only reads that carry no personal
// state go through here: the host-only API session cookie never reaches this server.
export function fetchPublic(url: string, headers: Record<string, string>): Promise<PublicResponse> {
    const key = `${headers.Origin ?? ""} ${url}`;
    const running = inflight.get(key);
    if (running) return running;
    const request = (async (): Promise<PublicResponse> => {
        const response = await fetch(url, {
            headers,
            next: {revalidate: PUBLIC_REVALIDATE_SECONDS},
            signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
        });
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
