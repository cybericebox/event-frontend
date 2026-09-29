// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {ReminderDaysField} from "./ReminderDaysField";

afterEach(cleanup);

describe("ReminderDaysField", () => {
    it("saves a valid number of days when the field loses focus", () => {
        const onCommit = vi.fn();
        render(<ReminderDaysField days={7} disabled={false} onCommit={onCommit} />);
        const input = screen.getByRole("spinbutton") as HTMLInputElement;
        expect(input.value).toBe("7");
        fireEvent.change(input, {target: {value: "3"}});
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith(3);
    });

    it("saves on Enter and does not resave an unchanged value", () => {
        const onCommit = vi.fn();
        render(<ReminderDaysField days={7} disabled={false} onCommit={onCommit} />);
        const input = screen.getByRole("spinbutton");
        fireEvent.blur(input);
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.change(input, {target: {value: "14"}});
        fireEvent.keyDown(input, {key: "Enter"});
        expect(onCommit).toHaveBeenCalledWith(14);
    });

    it.each(["0", "31", "2.5", ""])("rejects %j and restores the saved value", value => {
        const onCommit = vi.fn();
        render(<ReminderDaysField days={7} disabled={false} onCommit={onCommit} />);
        const input = screen.getByRole("spinbutton") as HTMLInputElement;
        fireEvent.change(input, {target: {value}});
        expect(screen.getByRole("alert").textContent).toContain("від 1 до 30");
        fireEvent.blur(input);
        expect(onCommit).not.toHaveBeenCalled();
        expect(input.value).toBe("7");
    });

    it("follows the saved value and can be locked", () => {
        const {rerender} = render(<ReminderDaysField days={7} disabled onCommit={vi.fn()} />);
        const input = screen.getByRole("spinbutton") as HTMLInputElement;
        expect(input.disabled).toBe(true);
        rerender(<ReminderDaysField days={10} disabled onCommit={vi.fn()} />);
        expect(input.value).toBe("10");
    });
});
