// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://event.test/"}
import {afterEach, expect, it, vi} from "vitest";
import {clearParticipantPreview, PREVIEW_STORAGE_KEY, readPreviewSnapshot, subscribePreviewSnapshot, writePreviewSnapshot} from "./previewStorage";

// Restore writable storage before clearing the module's in-memory fallback between cases.
afterEach(() => {vi.restoreAllMocks(); clearParticipantPreview(); localStorage.clear(); sessionStorage.clear();});

function rejectDurableWrites() {
    const original = Storage.prototype.setItem;
    return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
        if (this === localStorage) throw new DOMException("full", "QuotaExceededError");
        original.call(this, key, value);
    });
}

it("keeps the latest state authoritative when a readable durable store refuses writes", () => {
    localStorage.setItem(PREVIEW_STORAGE_KEY, "old-state");
    rejectDurableWrites();
    writePreviewSnapshot("new-state");
    expect(readPreviewSnapshot()).toBe("new-state");
    clearParticipantPreview();
    expect(readPreviewSnapshot()).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(PREVIEW_STORAGE_KEY) ?? "null")).toBeNull();
});

it("accepts another tab's newer state after a failed local write", () => {
    localStorage.setItem(PREVIEW_STORAGE_KEY, "old-state");
    const blocked = rejectDurableWrites();
    writePreviewSnapshot("unsaved-local-state");
    const unsubscribe = subscribePreviewSnapshot(() => {});
    try {
        blocked.mockRestore();
        localStorage.setItem(PREVIEW_STORAGE_KEY, "newer-other-tab-state");
        window.dispatchEvent(new StorageEvent("storage", {key: PREVIEW_STORAGE_KEY, newValue: "newer-other-tab-state", storageArea: localStorage}));
        expect(readPreviewSnapshot()).toBe("newer-other-tab-state");
    } finally {unsubscribe();}
});


it("restores the latest fallback after a module reload when quota blocks durable writes", async () => {
    localStorage.setItem(PREVIEW_STORAGE_KEY, "old-state");
    rejectDurableWrites();
    writePreviewSnapshot("new-state");
    vi.resetModules();
    const reloaded = await import("./previewStorage");
    expect(reloaded.readPreviewSnapshot()).toBe("new-state");
});

it("keeps explicit logout cleared after a module reload when quota blocks durable writes", async () => {
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({sessionID: "old-state"}));
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({sessionID: "legacy-state"}));
    rejectDurableWrites();
    clearParticipantPreview();
    vi.resetModules();
    const reloaded = await import("./previewStorage");
    expect(JSON.parse(reloaded.readPreviewSnapshot() ?? "null")).toBeNull();
});

it("retires an old tab snapshot when another tab removes the durable state", () => {
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({sessionID: "old-durable-state"}));
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({sessionID: "old-legacy-state"}));
    const unsubscribe = subscribePreviewSnapshot(() => {});
    try {
        localStorage.removeItem(PREVIEW_STORAGE_KEY);
        window.dispatchEvent(new StorageEvent("storage", {key: PREVIEW_STORAGE_KEY, newValue: null, storageArea: localStorage}));
        expect(JSON.parse(readPreviewSnapshot() ?? "null")).toBeNull();
    } finally {unsubscribe();}
});
