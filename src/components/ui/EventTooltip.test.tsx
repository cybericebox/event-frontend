// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {EventTooltip} from "./EventTooltip";

afterEach(cleanup);

describe("EventTooltip", () => {
    it("describes its trigger through the bubble id", () => {
        render(<EventTooltip content="Пояснення">{id => <button type="button" aria-describedby={id}>Дія</button>}</EventTooltip>);
        expect(screen.getByRole("button", {name: "Дія", description: "Пояснення"})).toBeTruthy();
    });

    it("keeps a silent bubble out of the accessibility tree", () => {
        render(<EventTooltip content="Перемістити" silent>{() => <button type="button" aria-label="Перемістити рядок" />}</EventTooltip>);
        expect(screen.queryByRole("tooltip")).toBeNull();
        expect(screen.getByText("Перемістити").getAttribute("aria-hidden")).toBe("true");
    });

    it("shows a truncated hint only when the text overflows", () => {
        const {container} = render(<EventTooltip content="Повний текст" truncated>{() => <span>Повний текст</span>}</EventTooltip>);
        const tip = container.querySelector(".ib-tip")!;
        const text = screen.getByText("Повний текст");
        fireEvent.pointerEnter(tip);
        expect(tip.classList.contains("is-dismissed")).toBe(true);
        expect(screen.getAllByText("Повний текст")).toHaveLength(1);

        Object.defineProperty(text, "scrollWidth", {configurable: true, value: 200});
        Object.defineProperty(text, "clientWidth", {configurable: true, value: 100});
        fireEvent.pointerEnter(tip);
        expect(tip.classList.contains("is-dismissed")).toBe(false);
        expect(screen.getAllByText("Повний текст")).toHaveLength(2);
    });
    it("keeps a bubble inside the viewport while it is still scaled to a point", () => {
        const {container} = render(<EventTooltip content="Довга назва університету">{() => <a href="#u">ХНУРЕ</a>}</EventTooltip>);
        const tip = container.querySelector(".ib-tip")!;
        const bubble = container.querySelector<HTMLElement>(".ib-tip__bubble")!;
        Object.defineProperty(bubble, "offsetWidth", {configurable: true, value: 200});
        Object.defineProperty(bubble, "offsetHeight", {configurable: true, value: 30});
        bubble.getBoundingClientRect = () => ({left: 380, right: 380, top: 500, bottom: 500, width: 0, height: 0, x: 380, y: 500, toJSON: () => ({})});
        Object.defineProperty(window, "innerWidth", {configurable: true, value: 390});
        fireEvent.pointerEnter(tip);
        expect(bubble.style.getPropertyValue("--ib-tip-shift")).toBe("-102px");
    });
});
