// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
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
        expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", true);
        fireEvent.change(screen.getByRole("textbox"), {target: {value: " Веб "}});
        expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", true);
        fireEvent.change(screen.getByRole("textbox"), {target: {value: "Крипто"}});
        expect(screen.getByRole("button", {name: "Зберегти"})).toBeTruthy();
    });
});

it("does not submit an unchanged rename through Enter", () => {
    const submit = vi.fn();
    render(<GroupNameDialog open mode="rename" initialName="Веб" otherNames={[]} busy={false} onClose={vi.fn()} onSubmit={submit} />);
    fireEvent.change(screen.getByRole("textbox"), {target: {value: " Веб "}});
    fireEvent.submit((screen.getByRole("textbox") as HTMLInputElement).form!);
    expect(submit).not.toHaveBeenCalled();
});

it("keeps a newer name editable when an older rename finishes", async () => {
    let acknowledge!: (saved: boolean) => void;
    const submit = vi.fn(() => new Promise<boolean>(resolve => { acknowledge = resolve; }));
    const close = vi.fn();
    const props = {open: true, mode: "rename" as const, initialName: "Веб", otherNames: [], busy: false, onClose: close, onSubmit: submit};
    const {rerender} = render(<GroupNameDialog {...props} />);
    const field = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(field, {target: {value: "Крипто"}});
    fireEvent.submit(field.form!);
    rerender(<GroupNameDialog {...props} busy />);
    expect(field.disabled).toBe(false);
    fireEvent.change(field, {target: {value: "Нові задачі"}});
    await act(async () => acknowledge(true));
    expect(close).not.toHaveBeenCalled();
    rerender(<GroupNameDialog {...props} initialName="Крипто" />);
    await waitFor(() => expect(screen.getByRole("button", {name: "Зберегти"})).toBeTruthy());
    expect(field.value).toBe("Нові задачі");
    fireEvent.change(field, {target: {value: "Крипто"}});
    expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", true);
});
