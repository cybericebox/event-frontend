// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {EventButton} from "./EventButton";

afterEach(cleanup);

describe("busy button", () => {
    it("names the running operation instead of the action, with the event logo, and is disabled", () => {
        const {rerender} = render(<EventButton className="ib-btn" busy={false} busyLabel="Зберігаємо…"><svg data-testid="icon" />Зберегти</EventButton>);
        const idle = screen.getByRole("button", {name: "Зберегти"});
        expect(idle).toHaveProperty("disabled", false);
        expect(idle.querySelector("img.ib-busy-mark")).toBeNull();

        rerender(<EventButton className="ib-btn" busy busyLabel="Зберігаємо…"><svg data-testid="icon" />Зберегти</EventButton>);
        const busy = screen.getByRole("button", {name: "Зберігаємо…"});
        expect(busy).toBe(idle);
        expect(busy).toHaveProperty("disabled", true);
        expect(busy.className).toContain("is-busy");
        expect(busy.querySelector("img.ib-busy-mark")).not.toBeNull();
        // The idle face (icon + label) stays in place, hidden, so the button keeps its width.
        expect(screen.getByTestId("icon").closest(".event-btn__face")?.getAttribute("aria-hidden")).toBe("true");
        expect(busy.querySelectorAll(".event-btn__face")).toHaveLength(2);
    });

    it("never loses its label: the busy label is in the button before the work starts", () => {
        render(<EventButton className="ib-btn" busy={false} busyLabel="Публікуємо…">Опублікувати</EventButton>);
        const button = screen.getByRole("button", {name: "Опублікувати"});
        expect(button.textContent).toContain("Публікуємо…");
        expect(button.querySelector(".event-btn__face--busy")?.getAttribute("aria-hidden")).toBe("true");
    });
});
