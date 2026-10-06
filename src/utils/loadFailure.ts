// How a failed load of the event is shown. Only a real 404 (and the 401/403 that look the same to the visitor)
// means «not found or no access». The backend answering with an error that carries X-Request-ID is a 500 page with a
// reference number. A network failure, or a 502/503/504 without X-Request-ID (a proxy answer, not our backend),
// means the backend is unavailable: the outage overlay.
export type LoadFailure = "notFound" | "unavailable" | "error";

export function loadFailure(error: unknown): LoadFailure {
    if (error instanceof TypeError) return "unavailable";
    const fields = error && typeof error === "object" ? error as {status?: unknown; requestId?: unknown} : {};
    const status = typeof fields.status === "number" ? fields.status : 0;
    if (status === 401 || status === 403 || status === 404) return "notFound";
    if (status >= 500) {
        if (fields.requestId) return "error";
        return status === 502 || status === 503 || status === 504 ? "unavailable" : "error";
    }
    return "error";
}
