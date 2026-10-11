// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, renderHook} from "@testing-library/react";
import {useBrandDraft} from "./BrandDraftField";

const eventID = "01900000-0000-7000-8000-000000000001";
const fileID = "01900000-0000-7000-8000-000000000002";
const maxBytes = 512 << 10;
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

describe("favicon draft", () => {
    it("keeps a successful upload in preview until appearance save publishes it", async () => {
        const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nYQAAAAASUVORK5CYII="), char => char.charCodeAt(0));
        const file = new File([png], "favicon.png", {type: "image/png"});
        const upload = vi.fn(async (url: string, init: RequestInit) => {
            expect(url).toBe(`https://api.example.test/api/events/${eventID}/manage/brand-drafts/favicon`);
            expect(init.credentials).toBe("include");
            expect((init.body as FormData).get("file")).toBe(file);
            return new Response(JSON.stringify({Data: {FileID: fileID}}), {status: 200});
        });
        vi.stubGlobal("fetch", upload);
        const OriginalURL = URL;
        vi.stubGlobal("URL", class extends OriginalURL {
            static createObjectURL() {return "blob:uploaded-favicon";}
            static revokeObjectURL() {}
        });
        const {result} = renderHook(() => useBrandDraft(eventID, "favicon", "", maxBytes));
        await act(async () => {expect(await result.current.select(file)).toBe(true);});
        expect(result.current.change).toEqual({Action: "replace", FileID: fileID});
        expect(result.current.source).toBe("blob:uploaded-favicon");
        expect(result.current.dirty).toBe(true);
        expect(result.current.uploading).toBe(false);
        const savedURL = `https://api.example.test/api/events/${eventID}/favicon/${fileID}`;
        act(() => result.current.saved(savedURL));
        expect(result.current.source).toBe(savedURL);
        expect(result.current.change).toEqual({Action: "keep"});
        expect(result.current.dirty).toBe(false);
    });

    it.each([
        ["empty PNG", new File([], "icon.png", {type: "image/png"})],
        ["oversize PNG", new File([new Uint8Array(maxBytes + 1)], "icon.png", {type: "image/png"})],
        ["different MIME type", new File(["image"], "icon.png", {type: "image/jpeg"})],
    ])("rejects %s before upload", async (_name, file) => {
        const upload = vi.fn();
        vi.stubGlobal("fetch", upload);
        const {result} = renderHook(() => useBrandDraft(eventID, "favicon", "/current-icon.png", maxBytes));
        await act(async () => {expect(await result.current.select(file)).toBe(false);});
        expect(upload).not.toHaveBeenCalled();
        expect(result.current.source).toBe("/current-icon.png");
        expect(result.current.change).toEqual({Action: "keep"});
        expect(result.current.error).toBeTruthy();
    });
});
