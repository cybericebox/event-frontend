import {clearPreviewCookie} from "./previewCookie";

export const PREVIEW_STORAGE_KEY = "event-participant-preview-v1";
export const PREVIEW_CHANGE_EVENT = "event-participant-preview-change";
let volatileSnapshot: string | null | undefined;

export function readPreviewSnapshot(): string | null {
    if (volatileSnapshot !== undefined) return volatileSnapshot;
    try {
        const durable = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
        if (durable !== null) return durable;
    } catch { /* Restricted persistent storage: try the legacy tab storage. */ }
    try {return window.sessionStorage.getItem(PREVIEW_STORAGE_KEY);} catch {return volatileSnapshot ?? null;}
}

export function subscribePreviewSnapshot(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== PREVIEW_STORAGE_KEY) return;
        // A durable deletion retires legacy tab state too; queued removal/addition events use the latest store.
        let removed = event.newValue === null;
        try {removed = window.localStorage.getItem(PREVIEW_STORAGE_KEY) === null;} catch { /* Use the event when reads are restricted. */ }
        volatileSnapshot = removed ? null : undefined;
        try {
            if (removed) window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, "null");
            else window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
        } catch { /* The in-memory snapshot still retires this tab. */ }
        onChange();
    };
    window.addEventListener(PREVIEW_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {window.removeEventListener(PREVIEW_CHANGE_EVENT, onChange); window.removeEventListener("storage", onStorage);};
}

export function writePreviewSnapshot(raw: string | null) {
    volatileSnapshot = raw;
    let durable = false;
    try {
        // Keep a cleared value so another tab cannot import its old sessionStorage after exit or logout.
        window.localStorage.setItem(PREVIEW_STORAGE_KEY, raw ?? "null");
        durable = true;
    } catch {
        // Quota may reject the replacement while reads still return the old instance. Remove it before fallback.
        try {
            window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
            window.localStorage.setItem(PREVIEW_STORAGE_KEY, raw ?? "null");
            durable = true;
        } catch { /* Keep the latest tab and memory state if persistent storage is still unavailable. */ }
    }
    if (durable) volatileSnapshot = undefined;
    try {
        if (!durable) window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, raw ?? "null");
        else window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch { /* Restricted browser storage: keep this page in memory. */ }
    window.dispatchEvent(new Event(PREVIEW_CHANGE_EVENT));
}

export function migratePreviewSnapshot(raw: string) {
    try {
        // Recheck both stores: a new instance or explicit exit in another tab wins over legacy data.
        if (window.localStorage.getItem(PREVIEW_STORAGE_KEY) !== null || window.sessionStorage.getItem(PREVIEW_STORAGE_KEY) !== raw) return false;
        window.localStorage.setItem(PREVIEW_STORAGE_KEY, raw);
        window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
        return true;
    } catch { /* The legacy tab state remains usable when persistent storage is unavailable. */ }
    return false;
}

export function clearParticipantPreview() {
    writePreviewSnapshot(null);
    clearPreviewCookie();
}
