// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {SetActions, setMenuItems} from "./SetActions";

afterEach(cleanup);

const attachment = {ID: "a", UpdateAvailable: true} as EventExerciseAttachment;

describe("SetActions", () => {
    it("offers an event copy with an explaining tooltip for a catalog set", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} onAction={onAction} />);
        const fork = screen.getByRole("button", {name: "Створити копію для заходу"});
        expect(document.getElementById(fork.getAttribute("aria-describedby")!)?.textContent).toContain("оновлення з каталогу більше не підтягуються");
        fireEvent.click(fork);
        fireEvent.click(screen.getByRole("button", {name: "Прибрати із заходу"}));
        expect(onAction.mock.calls).toEqual([["fork"], ["detach"]]);
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("keeps rare actions in «⋯»", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="fork" name="Test" editURL="https://x/detail" busy={false} onAction={onAction} />);
        expect(screen.queryByRole("button", {name: "Створити копію для заходу"})).toBeNull();
        expect(screen.getByRole("link", {name: "Редагувати набір"})).toBeTruthy();
        fireEvent.pointerDown(screen.getByRole("button", {name: "Інші дії з набором Test"}), {button: 0, ctrlKey: false});
        expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Оновити до нової версії", "Повернути версію з каталогу", "Прибрати із заходу"]);
        fireEvent.click(screen.getByRole("menuitem", {name: "Повернути версію з каталогу"}));
        expect(onAction).toHaveBeenCalledWith("revert");
    });

    it("always lists «Прибрати із заходу» in a wide action menu with icons", () => {
        expect(setMenuItems({UpdateAvailable: false}, "catalog").map(item => item.action)).toEqual(["detach"]);
        render(<SetActions attachment={{...attachment, UpdateAvailable: false}} kind="catalog" name="Test" editURL={null} busy={false} broken onAction={vi.fn()} />);
        fireEvent.pointerDown(screen.getByRole("button", {name: "Інші дії з набором Test"}), {button: 0, ctrlKey: false});
        const menu = screen.getByRole("menu");
        // Not the select menu sized to the 32px trigger.
        expect(menu.className).toContain("event-action-menu");
        expect(menu.className).not.toContain("event-select__menu");
        const item = screen.getByRole("menuitem", {name: "Прибрати із заходу"});
        expect(item.querySelector("svg")).toBeTruthy();
    });

    it("keeps the copy action off with its reason for a set that cannot work here", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} broken onAction={onAction} />);
        const fork = screen.getByRole("button", {name: "Створити копію для заходу"});
        expect(fork.getAttribute("aria-disabled")).toBe("true");
        expect(document.getElementById(fork.getAttribute("aria-describedby")!)?.textContent).toContain("Копія не допоможе");
        fireEvent.click(fork);
        expect(onAction).not.toHaveBeenCalled();
    });
});
