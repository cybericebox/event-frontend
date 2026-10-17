import {readApiErrorCode} from "./apiErrors";
import {isOverloadResponse, retryDelayMs} from "./retry";

// The one opt-in to repeating a POST, kept out of retry.ts (copied verbatim into every frontend, GET only).
// Only for a request the server deduplicates by its idempotency key: it replays a completed request with
// the same key instead of running it again, so a repeat can never count twice.

const MAX_ATTEMPTS = 4;
// A same-key request still running answers 409 "in progress"; it usually ends within a second.
const IN_PROGRESS_DELAY_MS = 1000;

export type IdempotentRetryOptions = {
    // The detail code of the endpoint's "still being processed" conflict.
    inProgressCode: number;
    sleep?: (ms: number) => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Sends the request again with the same key after an overload answer (429, or 503 with Retry-After) and
// while the same key is still in progress, up to 4 tries in all; returns the last Response.
export async function fetchIdempotentWithRetry(doFetch: () => Promise<Response>, opts: IdempotentRetryOptions): Promise<Response> {
    const wait = opts.sleep ?? sleep;
    for (let attempt = 0; ; attempt++) {
        const response = await doFetch();
        if (attempt + 1 >= MAX_ATTEMPTS) return response;
        let delay: number | null = null;
        if (isOverloadResponse(response)) delay = retryDelayMs(attempt, response.headers.get("Retry-After"));
        else if (response.status === 409 && await readApiErrorCode(response.clone()) === opts.inProgressCode) delay = IN_PROGRESS_DELAY_MS;
        if (delay === null) return response;
        // Release the connection held by the unread body of the discarded answer.
        response.body?.cancel().catch(() => undefined);
        await wait(delay);
    }
}
