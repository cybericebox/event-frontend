// @vitest-environment jsdom
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {EventDateTimePicker} from "./EventDateTimePicker";

function Controlled({initial = "", onValue}: {initial?: string; onValue: (value: string) => void}) {
    const [value, setValue] = useState(initial);
    return <EventDateTimePicker ariaLabel="Від" value={value} allowClear onChange={next => { setValue(next); onValue(next); }} />;
}

describe("EventDateTimePicker", () => {
    const zone = process.env.TZ;
    beforeAll(() => { process.env.TZ = "Europe/Kyiv"; });
    afterAll(() => { process.env.TZ = zone; });
    afterEach(cleanup);

    it("opens a calendar popover and picks a day with the keyboard", () => {
        const onValue = vi.fn();
        render(<Controlled initial="2026-09-29T14:30" onValue={onValue} />);
        const trigger = screen.getByRole("button", {name: "Від"});
        expect(trigger.textContent).toContain("29 вересня 2026, 14:30");
        fireEvent.click(trigger);
        const day = screen.getByRole("button", {name: "29 вересня 2026"});
        expect(day.getAttribute("aria-pressed")).toBe("true");
        expect(day.getAttribute("tabindex")).toBe("0");
        fireEvent.keyDown(day, {key: "ArrowRight"});
        const next = screen.getByRole("button", {name: "30 вересня 2026"});
        expect(next.getAttribute("tabindex")).toBe("0");
        fireEvent.click(next);
        expect(onValue).toHaveBeenLastCalledWith("2026-09-30T14:30");
    });

    it("lets the time be set before a day is chosen (today)", () => {
        const onValue = vi.fn();
        render(<Controlled onValue={onValue} />);
        fireEvent.click(screen.getByRole("button", {name: "Від"}));
        const hour = screen.getByRole("textbox", {name: "Година"});
        fireEvent.change(hour, {target: {value: "18"}});
        const value = onValue.mock.lastCall?.[0] as string;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        expect(value).toBe(`${today}T18:00`);
        fireEvent.keyDown(screen.getByRole("textbox", {name: "Хвилина"}), {key: "ArrowDown"});
        expect(onValue).toHaveBeenLastCalledWith(`${today}T18:59`);
    });

    it("shows the viewer's time zone and clears the value", () => {
        const onValue = vi.fn();
        render(<Controlled initial="2026-09-29T14:30" onValue={onValue} />);
        expect(screen.getByRole("button", {name: "Від"}).textContent).toContain("GMT+3");
        fireEvent.click(screen.getByRole("button", {name: "Від"}));
        expect(screen.getByText(/^Europe\/Ki.*\(GMT\+3\)$/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Без дати"}));
        expect(onValue).toHaveBeenLastCalledWith("");
    });
});
