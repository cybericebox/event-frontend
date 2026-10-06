// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {DateAnswerInput, formatDateAnswer} from "./DateAnswerInput";

afterEach(cleanup);

describe("date answer", () => {
    it("picks a day as YYYY-MM-DD with no time row", () => {
        const onChange = vi.fn();
        render(<DateAnswerInput mode="date" value="2026-09-15" onChange={onChange} ariaLabel="Дата" />);
        expect(screen.getByRole("button", {name: "Дата"}).textContent).toContain("15 вересня 2026");
        fireEvent.click(screen.getByRole("button", {name: "Дата"}));
        expect(screen.queryByRole("group", {name: "Час"})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "20 вересня 2026"}));
        expect(onChange).toHaveBeenLastCalledWith("2026-09-20");
    });

    it("keeps a date and time as UTC ISO", () => {
        const onChange = vi.fn();
        render(<DateAnswerInput mode="datetime" value="" onChange={onChange} ariaLabel="Коли" />);
        fireEvent.click(screen.getByRole("button", {name: "Коли"}));
        fireEvent.click(screen.getAllByRole("button", {pressed: false}).find(day => /^\d+$/.test(day.textContent ?? ""))!);
        const stored = onChange.mock.calls.at(-1)?.[0] as string;
        expect(stored).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    });

    it("picks a time of day as HH:MM", () => {
        const onChange = vi.fn();
        render(<DateAnswerInput mode="time" value="" onChange={onChange} ariaLabel="Прибуття" />);
        const group = screen.getByRole("group", {name: "Прибуття"});
        fireEvent.change(within(group).getByRole("textbox", {name: "Година"}), {target: {value: "09"}});
        expect(onChange).toHaveBeenLastCalledWith("09:00");
    });

    it("steps and clears a time", () => {
        const onChange = vi.fn();
        render(<DateAnswerInput mode="time" value="09:59" onChange={onChange} ariaLabel="Прибуття" />);
        fireEvent.keyDown(screen.getByRole("textbox", {name: "Хвилина"}), {key: "ArrowUp"});
        expect(onChange).toHaveBeenLastCalledWith("09:00");
        fireEvent.click(screen.getByRole("button", {name: "Очистити час"}));
        expect(onChange).toHaveBeenLastCalledWith("");
    });

    it("reads back for people", () => {
        expect(formatDateAnswer("time", "09:05")).toBe("09:05");
        expect(formatDateAnswer("date", "2026-09-15")).toBe("15 вересня 2026");
        expect(formatDateAnswer("datetime", new Date(2026, 8, 15, 9, 5).toISOString())).toMatch(/15 вересня 2026.*09:05/);
    });
});
