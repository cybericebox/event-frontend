// @vitest-environment jsdom
import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {EventSelect} from "./EventSelect";

describe("EventSelect", () => {
    it("opens its menu inside an enclosing <dialog>, not behind it", async () => {
        render(<dialog open data-testid="host"><EventSelect ariaLabel="Строк" value="a" onValueChange={vi.fn()} options={[{value: "a", label: "A"}, {value: "b", label: "B"}]} /></dialog>);
        const trigger = screen.getByRole("button", {name: "Строк"});
        fireEvent.pointerDown(trigger, {button: 0, ctrlKey: false});
        const option = await screen.findByRole("menuitemradio", {name: "B"});
        expect(screen.getByTestId("host").contains(option)).toBe(true);
    });
});
