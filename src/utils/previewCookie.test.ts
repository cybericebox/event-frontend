// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://event.test/"}
import {expect, it, vi} from "vitest";
import {setPreviewCookie} from "./previewCookie";

it("keeps the mode cookie across browser sessions with a durable, host-only cookie", () => {
    const setter = vi.spyOn(document, "cookie", "set");
    try {
        setPreviewCookie("event-1");
        expect(setter).toHaveBeenCalledWith(expect.stringMatching(/^cib_participant_preview=event-1; Path=\/; Max-Age=\d+; SameSite=Lax; Secure$/));
        const value = setter.mock.calls[0][0];
        expect(Number(/Max-Age=(\d+)/.exec(value)![1])).toBeGreaterThanOrEqual(60 * 60 * 24 * 30);
    } finally {setter.mockRestore();}
});
