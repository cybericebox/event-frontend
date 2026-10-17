import {isOverloadResponse, parseRetryAfterSeconds, retryDelayMs} from "./retry";
import {serverGet} from "./serverGet";

// A server render waits on these reads; a hung API must end in the error or outage
// state instead of streaming the route loader forever.
export const SERVER_FETCH_TIMEOUT_MS = 10_000;

// A server render waits for one more try only after a short Retry-After: a longer one ends in the error state at once.
const MAX_RENDER_RETRY_AFTER_S = 2;

// One more try when the API shed the read (429, or 503 with Retry-After) with a short Retry-After and the
// wait fits in what is left of the render budget; otherwise the first answer.
async function getWithOneRetry(url: string, headers: Record<string, string>): Promise<Response> {
    const deadline = Date.now() + SERVER_FETCH_TIMEOUT_MS;
    const signal = AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS);
    const first = await serverGet(url, headers, signal);
    const header = first.headers.get("Retry-After");
    const retryAfter = parseRetryAfterSeconds(header);
    if (!isOverloadResponse(first) || retryAfter === undefined || retryAfter > MAX_RENDER_RETRY_AFTER_S) return first;
    // The same timeout signal covers both tries, so the retry gets what is left of the budget.
    const delay = retryDelayMs(0, header);
    if (delay === null || Date.now() + delay >= deadline) return first;
    first.body?.cancel().catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, delay));
    return serverGet(url, headers, signal);
}

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
        const response = await getWithOneRetry(url, headers);
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
