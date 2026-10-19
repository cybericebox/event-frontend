// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
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

    describe("tap", () => {
        const help = (content: string) => <EventTooltip help content={content}>{id => <button type="button" aria-label={`Про ${content}`} aria-describedby={id}>?</button>}</EventTooltip>;
        const tipOf = (name: string) => screen.getByRole("button", {name}).closest(".ib-tip")!;

        it("toggles a help bubble on tap, closes it on a second tap", () => {
            render(help("Бали"));
            const button = screen.getByRole("button", {name: "Про Бали"});
            fireEvent.pointerDown(button, {pointerType: "touch"});
            fireEvent.click(button);
            expect(tipOf("Про Бали").classList.contains("is-open")).toBe(true);
            fireEvent.pointerDown(button, {pointerType: "touch"});
            fireEvent.click(button);
            expect(tipOf("Про Бали").classList.contains("is-open")).toBe(false);
        });

        it("closes on a tap outside and on Esc, without closing the dialog around it", () => {
            render(<>{help("Бали")}<p>Поза підказкою</p></>);
            const button = screen.getByRole("button", {name: "Про Бали"});
            fireEvent.click(button);
            expect(tipOf("Про Бали").classList.contains("is-open")).toBe(true);
            fireEvent.pointerDown(screen.getByText("Поза підказкою"));
            expect(tipOf("Про Бали").classList.contains("is-open")).toBe(false);

            fireEvent.click(button);
            const escape = new KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true});
            act(() => {window.dispatchEvent(escape);});
            expect(escape.defaultPrevented).toBe(true);
            expect(tipOf("Про Бали").classList.contains("is-open")).toBe(false);
        });

        it("keeps only one bubble open", () => {
            render(<>{help("Бали")}{help("Спроби")}</>);
            fireEvent.click(screen.getByRole("button", {name: "Про Бали"}));
            fireEvent.pointerDown(screen.getByRole("button", {name: "Про Спроби"}));
            fireEvent.click(screen.getByRole("button", {name: "Про Спроби"}));
            expect(tipOf("Про Бали").classList.contains("is-open")).toBe(false);
            expect(tipOf("Про Спроби").classList.contains("is-open")).toBe(true);
        });

        it("opens a plain trigger and a disabled control on touch, never on a mouse click", () => {
            render(<>
                <EventTooltip content="Сформовано 12 жовт.">{id => <span aria-describedby={id}>Сформована</span>}</EventTooltip>
                <EventTooltip content="Спершу розв'яжіть Login" silent>{() => <button type="button" aria-disabled="true">Закрите завдання</button>}</EventTooltip>
            </>);
            const tag = screen.getByText("Сформована");
            fireEvent.pointerDown(tag, {pointerType: "mouse"});
            fireEvent.click(tag);
            expect(tag.closest(".ib-tip")!.classList.contains("is-open")).toBe(false);
            fireEvent.pointerDown(tag, {pointerType: "touch"});
            fireEvent.click(tag);
            expect(tag.closest(".ib-tip")!.classList.contains("is-open")).toBe(true);

            const locked = screen.getByRole("button", {name: "Закрите завдання"});
            fireEvent.pointerDown(locked, {pointerType: "touch"});
            fireEvent.click(locked);
            expect(locked.closest(".ib-tip")!.classList.contains("is-open")).toBe(true);
        });

        it("lets a tap on an action button run the action, not the bubble", () => {
            const action = vi.fn();
            render(<EventTooltip content="Видалити команду">{id => <button type="button" aria-describedby={id} onClick={action}>Видалити</button>}</EventTooltip>);
            const button = screen.getByRole("button", {name: "Видалити"});
            fireEvent.pointerDown(button, {pointerType: "touch"});
            fireEvent.click(button);
            expect(action).toHaveBeenCalled();
            expect(button.closest(".ib-tip")!.classList.contains("is-open")).toBe(false);
        });

        it("places a tapped bubble inside the viewport and keeps it there after the finger lifts", () => {
            const {container} = render(help("Довга підказка біля правого краю"));
            const bubble = container.querySelector<HTMLElement>(".ib-tip__bubble")!;
            Object.defineProperty(bubble, "offsetWidth", {configurable: true, value: 200});
            Object.defineProperty(bubble, "offsetHeight", {configurable: true, value: 30});
            bubble.getBoundingClientRect = () => ({left: 380, right: 380, top: 500, bottom: 500, width: 0, height: 0, x: 380, y: 500, toJSON: () => ({})});
            Object.defineProperty(window, "innerWidth", {configurable: true, value: 390});
            const button = screen.getByRole("button", {name: "Про Довга підказка біля правого краю"});
            fireEvent.pointerDown(button, {pointerType: "touch"});
            fireEvent.click(button);
            fireEvent.pointerLeave(button.closest(".ib-tip")!);
            expect(bubble.style.getPropertyValue("--ib-tip-shift")).toBe("-102px");
            expect(button.closest(".ib-tip")!.classList.contains("is-open")).toBe(true);
        });
    });
});


it("opens a floating tooltip in the top layer and closes it on scroll",()=>{
 const {container}=render(<EventTooltip content="Скопіювати команду" floating>{()=> <button type="button">Копіювати</button>}</EventTooltip>);
 const bubble=container.querySelector<HTMLElement>("[popover=manual]")!;
 expect(bubble).not.toBeNull();
 bubble.showPopover=vi.fn();bubble.hidePopover=vi.fn();
 fireEvent.focus(screen.getByRole("button"));
 expect(bubble.showPopover).toHaveBeenCalled();
 fireEvent.scroll(window);
 expect(bubble.hidePopover).toHaveBeenCalled();
});
