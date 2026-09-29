// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {GroupNameDialog} from "./GroupNameDialog";

// jsdom has no top-layer dialog.
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

describe("GroupNameDialog", () => {
    it("focuses the name, validates it and submits on Enter", () => {
        vi.useFakeTimers();
        const submit = vi.fn();
        render(<GroupNameDialog open mode="create" initialName="" otherNames={["Веб"]} busy={false} onClose={vi.fn()} onSubmit={submit} />);
        act(() => {vi.runAllTimers();});
        vi.useRealTimers();
        const field = screen.getByRole("textbox") as HTMLInputElement;
        expect(document.activeElement).toBe(field);
        expect(screen.getByRole("heading", {name: "Нова група"})).toBeTruthy();

        fireEvent.submit(field.form!);
        expect(screen.getByRole("alert").textContent).toBe("Вкажіть назву групи.");
        fireEvent.change(field, {target: {value: " веб "}});
        fireEvent.submit(field.form!);
        expect(screen.getByRole("alert").textContent).toBe("Група з такою назвою вже існує.");
        expect(submit).not.toHaveBeenCalled();

        fireEvent.change(field, {target: {value: " Крипто "}});
        fireEvent.submit(field.form!);
        expect(submit).toHaveBeenCalledWith("Крипто");
    });

    it("renames with the current name prefilled", () => {
        render(<GroupNameDialog open mode="rename" initialName="Веб" otherNames={[]} busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
        expect(screen.getByRole("heading", {name: "Перейменувати групу"})).toBeTruthy();
        expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Веб");
        expect(screen.getByRole("button", {name: "Зберегти"})).toBeTruthy();
    });
});
