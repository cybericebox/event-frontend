// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, renderHook} from "@testing-library/react";
import {useEventStream} from "./eventStream";

class FakeEventSource {
    static open: FakeEventSource[] = [];
    closed = false;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public url: string) { FakeEventSource.open.push(this); }
    addEventListener() {}
    close() { this.closed = true; }
}

let hidden = false;
function setHidden(value: boolean) {
    hidden = value;
    document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.open = [];
    hidden = false;
    vi.stubGlobal("EventSource", FakeEventSource);
    Object.defineProperty(document, "hidden", {configurable: true, get: () => hidden});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("closes the stream while the tab is hidden and reloads at once when it is shown", () => {
    const onChange = vi.fn();
    renderHook(() => useEventStream({url: () => "https://api.test/live", events: ["result-change"], onChange, enabled: true, pauseWhenHidden: true}));
    expect(FakeEventSource.open).toHaveLength(1);

    setHidden(true);
    expect(FakeEventSource.open[0].closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.open).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();

    setHidden(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1200);
    expect(FakeEventSource.open).toHaveLength(2);
});

it("does not open a stream in a tab that starts hidden", () => {
    hidden = true;
    renderHook(() => useEventStream({url: () => "https://api.test/live", events: [], onChange: vi.fn(), enabled: true, pauseWhenHidden: true}));
    expect(FakeEventSource.open).toHaveLength(0);
});

it("keeps streaming in a hidden tab without pauseWhenHidden", () => {
    renderHook(() => useEventStream({url: () => "https://api.test/live", events: [], onChange: vi.fn(), enabled: true}));
    setHidden(true);
    expect(FakeEventSource.open[0].closed).toBe(false);
});
