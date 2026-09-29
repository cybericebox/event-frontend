// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {SetActions} from "./SetActions";

afterEach(cleanup);

const attachment = {ID: "a", UpdateAvailable: true} as EventExerciseAttachment;

function openMenu() {
    fireEvent.pointerDown(screen.getByRole("button", {name: "Дії з набором Test"}), {button: 0, ctrlKey: false});
    return screen.getByRole("menu");
}

describe("SetActions", () => {
    it("puts every action of a catalog set in «⋯», removing last in danger colour", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} onAction={onAction} />);
        // Only «⋯» in the header.
        expect(screen.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Дії з набором Test"]);
        const menu = openMenu();
        expect(menu.className).toContain("event-action-menu");
        const items = screen.getAllByRole("menuitem");
        expect(items.map(item => item.textContent)).toEqual(["Створити копію для заходу", "Оновити до нової версії", "Прибрати із заходу"]);
        expect(items.every(item => item.querySelector("svg"))).toBe(true);
        expect(items[2].className).toContain("is-danger");
        expect(menu.querySelector(".event-action-menu__separator")).toBeTruthy();
        fireEvent.click(items[0]);
        expect(onAction).toHaveBeenCalledWith("fork");
    });

    it("offers edit and the catalog version for an event copy", () => {
        render(<SetActions attachment={{...attachment, UpdateAvailable: false}} kind="fork" name="Test" editURL="https://x/detail" busy={false} onAction={vi.fn()} />);
        openMenu();
        expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Редагувати набір", "Повернути версію з каталогу", "Прибрати із заходу"]);
        expect(screen.getByRole("menuitem", {name: "Редагувати набір"}).getAttribute("href")).toBe("https://x/detail");
    });

    it("keeps the copy off with its reason for a set that cannot work here", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} broken onAction={onAction} />);
        openMenu();
        const fork = screen.getByRole("menuitem", {name: /Створити копію для заходу/});
        expect(fork.getAttribute("aria-disabled")).toBe("true");
        expect(fork.textContent).toContain("Копія не допоможе");
        fireEvent.click(fork);
        expect(onAction).not.toHaveBeenCalled();
    });
});
