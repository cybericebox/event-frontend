// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {SetActions} from "./SetActions";

afterEach(cleanup);

const attachment = {ID: "a", UpdateAvailable: true} as EventExerciseAttachment;
const group = () => screen.getByRole("group", {name: "Дії з набором Test"});
const names = () => Array.from(group().querySelectorAll("button, a")).map(item => item.getAttribute("aria-label"));
const tip = (element: Element) => document.getElementById(element.getAttribute("aria-describedby")!)?.textContent;

describe("SetActions", () => {
    it("shows icon-only actions of a catalog set in order, removing last", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} onAction={onAction} />);
        expect(names()).toEqual(["Створити копію для заходу", "Оновити до нової версії", "Прибрати із заходу"]);
        const remove = within(group()).getByRole("button", {name: "Прибрати із заходу"});
        // Icon only: no visible text, the name is in the tooltip and aria-label.
        expect(remove.textContent).toBe("");
        expect(remove.querySelector("svg")).toBeTruthy();
        expect(remove.className).toContain("is-danger");
        expect(tip(remove)).toBe("Прибрати із заходу");
        fireEvent.click(within(group()).getByRole("button", {name: "Створити копію для заходу"}));
        fireEvent.click(remove);
        expect(onAction.mock.calls).toEqual([["fork"], ["detach"]]);
    });

    it("offers edit and the catalog version for an event copy", () => {
        render(<SetActions attachment={{...attachment, UpdateAvailable: false}} kind="fork" name="Test" editURL="https://x/detail" busy={false} onAction={vi.fn()} />);
        expect(names()).toEqual(["Редагувати набір", "Повернути версію з каталогу", "Прибрати із заходу"]);
        expect(screen.getByRole("link", {name: "Редагувати набір"}).getAttribute("href")).toBe("https://x/detail");
    });

    it("keeps the copy off and explains why in its tooltip", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} broken onAction={onAction} />);
        const fork = screen.getByRole("button", {name: "Створити копію для заходу"});
        expect(fork.getAttribute("aria-disabled")).toBe("true");
        expect(tip(fork)).toContain("Копія не допоможе");
        fireEvent.click(fork);
        expect(onAction).not.toHaveBeenCalled();
    });
});
