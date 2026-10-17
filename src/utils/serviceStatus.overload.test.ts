import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {getServiceStatus, reportServiceAvailable, trackApiFetch} from "./serviceStatus";

const origin = "https://api.example.com";
const overloaded = () => new Response(null, {status: 503, headers: {"Retry-After": "1"}});
const ok = () => new Response("{}", {status: 200});

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    reportServiceAvailable();
});

function tracked(...answers: Array<() => Response>) {
    let call = 0;
    const base = vi.fn(() => Promise.resolve(answers[Math.min(call++, answers.length - 1)]()));
    return {base, fetch: trackApiFetch(base as unknown as typeof fetch, origin)};
}

it("repeats a GET the server shed and does not report the intermediate 503 as an outage", async () => {
    const {base, fetch} = tracked(overloaded, ok);
    const pending = fetch(`${origin}/api/events/e1/teams/challenges/mine`);
    await vi.advanceTimersByTimeAsync(0);
    expect(getServiceStatus()).toBe("up");
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
    expect(getServiceStatus()).toBe("up");
});

it.each([
    ["the daemon shape (with X-Request-ID)", {"Retry-After": "1", "X-Request-ID": "req-1"}],
    ["the proxy shape (without X-Request-ID)", {"Retry-After": "1"}],
])("never takes an overload answer for an outage, the final one included: %s", async (_, headers) => {
    const {base, fetch} = tracked(() => new Response(null, {status: 503, headers}));
    const pending = fetch(`${origin}/api/events/e1/teams/challenges/mine`);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).status).toBe(503);
    expect(base).toHaveBeenCalledTimes(4);
    expect(getServiceStatus()).toBe("up");
});

it("never takes an overloaded POST or a 429 for an outage", async () => {
    const {fetch} = tracked(overloaded, () => new Response(null, {status: 429}));
    await fetch(`${origin}/api/events/e1/teams/challenges/c1/submit`, {method: "POST", body: "{}"});
    await fetch(`${origin}/api/events/e1/teams/challenges/c1/submit`, {method: "POST", body: "{}"});
    expect(getServiceStatus()).toBe("up");
});

it("still reports a bare 503 (no Retry-After, no X-Request-ID) at once", async () => {
    const {base, fetch} = tracked(() => new Response(null, {status: 503}));
    expect((await fetch(`${origin}/api/events/e1/teams/challenges/mine`)).status).toBe(503);
    expect(base).toHaveBeenCalledTimes(1);
    expect(getServiceStatus()).toBe("suspect");
});

it("never repeats a POST", async () => {
    const {base, fetch} = tracked(overloaded, ok);
    const response = await fetch(`${origin}/api/events/e1/teams/challenges/c1/submit`, {method: "POST", body: "{}"});
    expect(response.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(1);
});

it("leaves the live streams untouched", async () => {
    const {base, fetch} = tracked(overloaded, ok);
    const response = await fetch(`${origin}/api/events/e1/results/live`);
    expect(response.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(1);
    expect(getServiceStatus()).toBe("up");
});

it("stops waiting when the caller aborts during the backoff, without an outage", async () => {
    const {base, fetch} = tracked(overloaded, ok);
    const controller = new AbortController();
    const pending = fetch(`${origin}/api/events/e1/teams/challenges/mine`, {signal: controller.signal});
    const failed = expect(pending).rejects.toMatchObject({name: "AbortError"});
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await failed;
    await vi.advanceTimersByTimeAsync(5000);
    expect(base).toHaveBeenCalledTimes(1);
    expect(getServiceStatus()).toBe("up");
});
