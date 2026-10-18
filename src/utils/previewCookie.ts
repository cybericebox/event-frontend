// The «view as participant» mode flag, mirrored into a session cookie so the server render knows it and
// paints the participant view from the first byte. The cookie only HIDES staff UI; it grants nothing
// (the backend and the preview grant decide access). The preview state itself stays in sessionStorage.
// No "use client": server layouts read the name, the browser helpers below are guarded.

export const PREVIEW_COOKIE = "cib_participant_preview";

// Event ids are UUIDs; anything else in the cookie is ignored.
const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function parsePreviewCookie(value: string | null | undefined): string | null {
    return value && VALID_ID.test(value) ? value : null;
}

export function readPreviewCookie(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.split("; ").find(part => part.startsWith(`${PREVIEW_COOKIE}=`));
    return parsePreviewCookie(match?.slice(PREVIEW_COOKIE.length + 1));
}

// Session cookie (no Max-Age), host-only (no Domain), readable by the client.
export function setPreviewCookie(eventID: string): void {
    if (typeof document === "undefined" || !parsePreviewCookie(eventID)) return;
    document.cookie = `${PREVIEW_COOKIE}=${eventID}; Path=/; SameSite=Lax; Secure`;
}

export function clearPreviewCookie(): void {
    if (typeof document === "undefined") return;
    document.cookie = `${PREVIEW_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}
