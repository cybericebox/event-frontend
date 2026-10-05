// @vitest-environment jsdom
import {act, cleanup, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {StageTimers} from "./StageTimers";

beforeEach(() => {vi.useFakeTimers();});
afterEach(() => {cleanup(); vi.useRealTimers();});

const T = Date.parse("2026-10-01T10:00:00Z");
const stage = {ID: "11111111-1111-4111-8111-111111111111", Name: "Розминка", OpensAt: "2026-10-01T09:00:00Z", EndsAt: "2026-10-01T10:01:05Z", Last: false};

describe("stage timers", () => {
    it("counts down to the end of the stage with its name, against the server clock", () => {
        vi.setSystemTime(T - 3_600_000); // the browser clock is an hour off; the offset fixes it
        render(<StageTimers board={{CurrentStage: stage, NextOpensAt: null}} offset={3_600_000} onZero={() => {}} />);
        expect(screen.getByText("Етап «Розминка»")).toBeTruthy();
        expect(screen.getByText("Залишилось у етапі", {selector: "span"})).toBeTruthy();
        expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Залишилось у етапі: 00 годин, 01 хвилина, 05 секунд");
        act(() => {vi.advanceTimersByTime(1000);});
        expect(screen.getByRole("timer").getAttribute("aria-label")).toContain("04 секунди");
    });

    it("shows «Перерва до …» with a countdown to the next stage during a break", () => {
        vi.setSystemTime(T);
        render(<StageTimers board={{CurrentStage: null, NextOpensAt: "2026-10-01T10:30:00Z"}} offset={0} onZero={() => {}} />);
        expect(screen.getAllByText(/^Перерва до \d{2}:\d{2}$/).length).toBeGreaterThan(0);
        expect(screen.getByRole("timer")).toBeTruthy();
    });

    it("shows nothing without a stage countdown (no stages, the last stage, a hidden countdown)", () => {
        vi.setSystemTime(T);
        const {container} = render(<StageTimers board={{CurrentStage: {...stage, EndsAt: null, Last: true}, NextOpensAt: null}} offset={0} onZero={() => {}} />);
        expect(container.textContent).toBe("");
    });

    it("tells the board to refetch when the countdown reaches zero", () => {
        vi.setSystemTime(T);
        const zero = vi.fn();
        render(<StageTimers board={{CurrentStage: {...stage, EndsAt: "2026-10-01T10:00:02Z"}, NextOpensAt: null}} offset={0} onZero={zero} />);
        act(() => {vi.advanceTimersByTime(3000);});
        expect(zero).toHaveBeenCalled();
    });
});
