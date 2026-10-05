import {afterEach, expect, it, vi} from "vitest";
import {isEventGone, resetEventGone} from "./eventGone";
import {trackApiFetch} from "./serviceStatus";

const origin = "https://api.example.com";
afterEach(resetEventGone);

it("checks the event when a call of this event answers 404, and marks it gone on a second 404", async () => {
    const base = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, {status: 404})));
    const tracked = trackApiFetch(base as unknown as typeof fetch, origin);
    await tracked(`${origin}/api/events/self/participant-info`);
    await vi.waitFor(() => expect(isEventGone()).toBe(true));
    expect(base.mock.calls.map(call => call[0])).toEqual([`${origin}/api/events/self/participant-info`, `${origin}/api/events/self/public-info`]);
});

it("does not mark the event gone when the event still answers", async () => {
    const base = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(null, {status: url.endsWith("public-info") ? 200 : 404})));
    const tracked = trackApiFetch(base as unknown as typeof fetch, origin);
    await tracked(`${origin}/api/events/self/participant-info`);
    await vi.waitFor(() => expect(base).toHaveBeenCalledTimes(2));
    expect(isEventGone()).toBe(false);
});

it("ignores a 404 of another resource", async () => {
    const base = vi.fn().mockResolvedValue(new Response(null, {status: 404}));
    await trackApiFetch(base as unknown as typeof fetch, origin)(`${origin}/api/events/abc/results`);
    expect(base).toHaveBeenCalledTimes(1);
});
