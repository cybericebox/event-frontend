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

class ListeningEventSource {
    static last: ListeningEventSource | null = null;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    listeners = new Map<string, () => void>();
    constructor(public url: string) { ListeningEventSource.last = this; }
    addEventListener(name: string, handler: () => void) { this.listeners.set(name, handler); }
    emit(name: string) { this.listeners.get(name)?.(); }
    close() {}
}

it("marks the page alive on open, on listed events and on heartbeats", () => {
    vi.stubGlobal("EventSource", ListeningEventSource);
    const onAlive = vi.fn();
    const onChange = vi.fn();
    renderHook(() => useEventStream({url: () => "https://api.example.org/live", events: ["attempts-changed"], onChange, onAlive, enabled: true}));
    const source = ListeningEventSource.last!;
    source.onopen?.();
    source.emit("heartbeat");
    source.emit("attempts-changed");
    expect(onAlive).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenCalledOnce();
});

it("keeps retrying after falling back to polling", () => {
    renderHook(() => useEventStream({url: () => "https://api.example.org/live", events: [], onChange: vi.fn(), enabled: true}));
    for (let attempt = 0; attempt < 3; attempt++) {
        FakeEventSource.open.at(-1)?.onerror?.();
        vi.advanceTimersByTime(10_000);
    }
    const opened = FakeEventSource.open.length;
    vi.advanceTimersByTime(40_000);
    expect(FakeEventSource.open.length).toBe(opened + 1);
});
