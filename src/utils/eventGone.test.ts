import {afterEach, describe, expect, it, vi} from "vitest";
import {isEventGone, isEventSelfRequest, reportEventNotFound, resetEventGone, subscribeEventGone} from "./eventGone";

const origin = "https://api.example.com";
afterEach(resetEventGone);

describe("isEventSelfRequest", () => {
    it("matches calls of this event, not other APIs or the public-info check itself", () => {
        expect(isEventSelfRequest(`${origin}/api/events/self/participant-info`, origin)).toBe(true);
        expect(isEventSelfRequest(`${origin}/api/events/self/public-info`, origin)).toBe(false);
        expect(isEventSelfRequest(`${origin}/api/events/abc/results`, origin)).toBe(false);
        expect(isEventSelfRequest("https://other.example.com/api/events/self/info", origin)).toBe(false);
    });
});

describe("reportEventNotFound", () => {
    it("marks the event gone when the public info answers 404 and tells subscribers", async () => {
        const listener = vi.fn();
        subscribeEventGone(listener);
        await reportEventNotFound(origin, vi.fn().mockResolvedValue(new Response(null, {status: 404})));
        expect(isEventGone()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it.each([200, 500, 403])("keeps the event when the public info answers %i", async status => {
        await reportEventNotFound(origin, vi.fn().mockResolvedValue(new Response(null, {status})));
        expect(isEventGone()).toBe(false);
    });

    it("keeps the event on a network failure", async () => {
        await reportEventNotFound(origin, vi.fn().mockRejectedValue(new TypeError("failed")));
        expect(isEventGone()).toBe(false);
    });
});
