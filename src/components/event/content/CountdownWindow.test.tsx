// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, render, screen, act} from "@testing-library/react";
import {CountdownWindow} from "./CountdownWindow";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("reveals at show time and hides after reaching zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T09:59:59Z"));
    render(<CountdownWindow showFrom="2026-09-28T10:00:00Z" target="2026-09-28T10:00:02Z" hideAfterFinish><span>Відлік</span></CountdownWindow>);
    expect(screen.queryByText("Відлік")).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("Відлік")).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText("Відлік")).toBeNull();
});
