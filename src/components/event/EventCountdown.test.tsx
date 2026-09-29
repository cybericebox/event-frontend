// @vitest-environment jsdom
import {act, cleanup, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {EventCountdown} from "./EventCountdown";

const start = Date.parse("2026-10-01T10:00:00Z");
const finish = Date.parse("2026-10-01T14:00:00Z");
const schedule = {
    StartTime: "2026-10-01T10:00:00Z", FinishTime: "2026-10-01T14:00:00Z",
    ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 10,
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("EventCountdown", () => {
    it("shows the start countdown with the hint and ticks every second", () => {
        vi.setSystemTime(start - 65_000);
        render(<EventCountdown event={schedule} hint="Завдання стануть доступні одразу після старту" />);
        expect(screen.getByText("До старту")).toBeTruthy();
        expect(screen.getByText("Завдання стануть доступні одразу після старту")).toBeTruthy();
        expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("00 годин, 01 хвилина, 05 секунд");
        act(() => { vi.advanceTimersByTime(1000); });
        expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("00 годин, 01 хвилина, 04 секунди");
    });

    it("switches by itself: start, silence, finish countdown, finished", () => {
        vi.setSystemTime(start - 2000);
        render(<EventCountdown event={schedule} />);
        expect(screen.getByText("До старту")).toBeTruthy();
        act(() => { vi.advanceTimersByTime(3000); });
        expect(screen.queryByText("До старту")).toBeNull();
        expect(screen.queryByRole("timer")).toBeNull();
        act(() => { vi.advanceTimersByTime(finish - 10 * 60_000 - Date.now() + 100); });
        expect(screen.getByText("До завершення")).toBeTruthy();
        act(() => { vi.advanceTimersByTime(finish - Date.now() + 100); });
        expect(screen.getByText("Захід завершено")).toBeTruthy();
        expect(screen.queryByRole("timer")).toBeNull();
    });

    it("leaves the finished state to the page when asked", () => {
        vi.setSystemTime(finish + 1000);
        const {container} = render(<EventCountdown event={schedule} showFinished={false} />);
        expect(container.textContent).toBe("");
    });

    it("renders nothing while the switches are off", () => {
        vi.setSystemTime(start - 1000);
        const {container} = render(<EventCountdown event={{...schedule, ShowStartCountdown: false}} />);
        expect(container.textContent).toBe("");
    });
});
