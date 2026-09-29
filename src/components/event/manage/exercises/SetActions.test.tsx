// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {SetActions} from "./SetActions";

afterEach(cleanup);

const attachment = {ID: "a", UpdateAvailable: true} as EventExerciseAttachment;
const toolbar = () => screen.getByRole("toolbar", {name: "Дії з набором Test"});
const labels = () => Array.from(toolbar().children).map(item => item.textContent);

describe("SetActions", () => {
    it("lists a catalog set's actions in order, removing last at the end", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} onAction={onAction} />);
        expect(labels()).toEqual(["Створити копію для заходу", "Оновити до нової версії", "Прибрати із заходу"]);
        const remove = screen.getByRole("button", {name: "Прибрати із заходу"});
        expect(remove.className).toContain("ib-btn--danger");
        expect(remove.className).toContain("event-action-toolbar__end");
        expect(within(toolbar()).getAllByRole("button").every(button => button.querySelector("svg"))).toBe(true);
        fireEvent.click(screen.getByRole("button", {name: "Створити копію для заходу"}));
        fireEvent.click(remove);
        expect(onAction.mock.calls).toEqual([["fork"], ["detach"]]);
    });

    it("offers edit and the catalog version for an event copy", () => {
        render(<SetActions attachment={{...attachment, UpdateAvailable: false}} kind="fork" name="Test" editURL="https://x/detail" busy={false} onAction={vi.fn()} />);
        expect(labels()).toEqual(["Редагувати набір", "Повернути версію з каталогу", "Прибрати із заходу"]);
        expect(screen.getByRole("link", {name: "Редагувати набір"}).getAttribute("href")).toBe("https://x/detail");
    });

    it("keeps the copy off with its reason for a set that cannot work here", () => {
        const onAction = vi.fn();
        render(<SetActions attachment={attachment} kind="catalog" name="Test" editURL={null} busy={false} broken onAction={onAction} />);
        const fork = screen.getByRole("button", {name: "Створити копію для заходу"});
        expect(fork.getAttribute("aria-disabled")).toBe("true");
        expect(document.getElementById(fork.getAttribute("aria-describedby")!)?.textContent).toContain("Копія не допоможе");
        fireEvent.click(fork);
        expect(onAction).not.toHaveBeenCalled();
    });
});
