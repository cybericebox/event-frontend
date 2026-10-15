// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

vi.mock("@/utils/theme", () => ({readThemeChoice: () => "light", setThemeChoice: vi.fn(), watchSystemTheme: () => () => {}}));
const {ThemeToggle} = await import("./ThemeToggle");
const {setThemeChoice} = await import("@/utils/theme");

beforeEach(() => { vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("is one tab stop: only the checked radio is tabbable, and it carries no duplicate description", () => {
    render(<ThemeToggle />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map(radio => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(radios.every(radio => !radio.hasAttribute("aria-describedby"))).toBe(true);
});

it("moves and selects with the arrow keys", () => {
    render(<ThemeToggle />);
    fireEvent.keyDown(screen.getByRole("radio", {name: "Світла тема"}), {key: "ArrowRight"});
    expect(setThemeChoice).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("radio", {name: "Темна тема"}).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("radio", {name: "Темна тема"}));
});

it("starts the account theme row collapsed and keeps all choices inside it", () => {
    const {container} = render(<ThemeToggle compact />);
    const disclosure = container.querySelector("details")!;
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector("summary")?.textContent).toContain("Тема");
    expect(disclosure.querySelectorAll('[role="radio"]')).toHaveLength(3);
    fireEvent.click(disclosure.querySelector('[data-value="dark"]')!);
    expect(setThemeChoice).toHaveBeenCalledWith("dark");
});

it("collapses the theme choices with ArrowLeft and returns focus to the row", () => {
    const {container} = render(<ThemeToggle compact />);
    const disclosure = container.querySelector("details")!;
    const summary = disclosure.querySelector("summary")!;
    fireEvent.keyDown(summary, {key: "ArrowRight"});
    expect(disclosure.open).toBe(true);
    fireEvent.keyDown(disclosure.querySelector('[data-value="light"]')!, {key: "ArrowLeft"});
    expect(disclosure.open).toBe(false);
    expect(document.activeElement).toBe(summary);
});
