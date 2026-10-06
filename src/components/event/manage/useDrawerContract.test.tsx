// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {useCallback, useRef, useState} from "react";
import {useDrawerContract} from "./useDrawerContract";

afterEach(cleanup);

function Harness() {
    const [open, setOpen] = useState(false);
    const drawer = useRef<HTMLElement>(null);
    const opener = useRef<HTMLButtonElement>(null);
    const behind = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setOpen(false), []);
    useDrawerContract({open, onClose: close, drawer, opener, behind});
    return <div>
        <aside ref={drawer}><button type="button">Перший</button><button type="button">Останній</button></aside>
        <div ref={behind}><button ref={opener} type="button" onClick={() => setOpen(true)}>Меню</button></div>
    </div>;
}

describe("useDrawerContract", () => {
    it("moves focus in, traps Tab, closes on Esc and returns focus to the opener", () => {
        render(<Harness />);
        const menu = screen.getByRole("button", {name: "Меню"});
        menu.focus();
        fireEvent.click(menu);
        const first = screen.getByRole("button", {name: "Перший"});
        const last = screen.getByRole("button", {name: "Останній"});
        expect(document.activeElement).toBe(first);
        expect(menu.parentElement!.hasAttribute("inert")).toBe(true);
        last.focus();
        fireEvent.keyDown(document, {key: "Tab"});
        expect(document.activeElement).toBe(first);
        fireEvent.keyDown(document, {key: "Tab", shiftKey: true});
        expect(document.activeElement).toBe(last);
        fireEvent.keyDown(document, {key: "Escape"});
        expect(menu.parentElement!.hasAttribute("inert")).toBe(false);
        expect(document.activeElement).toBe(menu);
    });
});
