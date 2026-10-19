// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import toast from "react-hot-toast";
import {EventActionToaster} from "./EventActionToaster";
import {ManageDialog} from "@/components/event/manage/invites/ManageDialog";

// jsdom has no top layer: showModal only sets [open], and :modal is matched by that.
beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {this.removeAttribute("open");};
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
        return selector === ":modal" ? this.hasAttribute("open") : matches.call(this, selector);
    });
});

afterEach(() => {
    act(() => toast.remove());
    cleanup();
});

describe("EventActionToaster", () => {
    it("renders the toasts inside the open modal dialog, the last opened one, and back in the page after it closes", async () => {
        render(<><EventActionToaster /><dialog data-testid="task">Завдання</dialog><dialog data-testid="confirm">Підтвердження</dialog></>);
        const task = screen.getByTestId("task") as HTMLDialogElement;
        const confirm = screen.getByTestId("confirm") as HTMLDialogElement;

        act(() => task.showModal());
        act(() => {toast.error("Не вдалося оновити завдання");});
        await vi.waitFor(() => expect(task.contains(screen.getByText("Не вдалося оновити завдання"))).toBe(true));

        act(() => confirm.showModal());
        await vi.waitFor(() => expect(confirm.contains(screen.getByText("Не вдалося оновити завдання"))).toBe(true));

        act(() => {confirm.close(); task.close();});
        await vi.waitFor(() => expect(screen.getByText("Не вдалося оновити завдання").closest("dialog")).toBeNull());
    });

    it("keeps a toast in an open dialog closable", async () => {
        render(<><EventActionToaster /><dialog data-testid="task">Завдання</dialog></>);
        const task = screen.getByTestId("task") as HTMLDialogElement;
        act(() => task.showModal());
        act(() => {toast.error("Не вдалося видалити сторінку");});
        await screen.findByText("Не вдалося видалити сторінку");
        const close = await vi.waitFor(() => {
            const button = screen.getByRole("button", {name: "Закрити сповіщення Не вдалося видалити сторінку"});
            expect(task.contains(button)).toBe(true);
            return button;
        });
        act(() => fireEvent.click(close));
        await vi.waitFor(() => expect(screen.getByRole("alert").getAttribute("data-visible")).toBe("false"));
    });

    it("renders the toasts inside an open Radix dialog: above its backdrop, and closing a toast keeps the dialog open", async () => {
        const onOpenChange = vi.fn();
        render(<><EventActionToaster /><ManageDialog open onOpenChange={onOpenChange} title="Нова команда" footer={null}><p>Поля</p></ManageDialog></>);
        const dialog = await screen.findByRole("dialog");
        act(() => {toast.error("Не вдалося прочитати CSV");});
        await vi.waitFor(() => expect(dialog.contains(screen.getByText("Не вдалося прочитати CSV"))).toBe(true));
        const close = screen.getByRole("button", {name: "Закрити сповіщення Не вдалося прочитати CSV"});
        fireEvent.pointerDown(close);
        fireEvent.click(close);
        await vi.waitFor(() => expect(screen.getByRole("alert").getAttribute("data-visible")).toBe("false"));
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBe(dialog);
    });
});
