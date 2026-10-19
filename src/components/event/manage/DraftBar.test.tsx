// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {t} from "@/i18n/t";
import {DraftBar} from "./DraftBar";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {this.setAttribute("open", "");};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {this.removeAttribute("open");};
afterEach(cleanup);

function bar(onDiscardDraft: () => Promise<string | null>) {
    return render(<DraftBar state={{dirty: false, hasDraft: true, published: true}} busy={null} canManage invalid={false}
        onSave={vi.fn()} onPublish={vi.fn()} onRevertLocal={vi.fn()} onDiscardDraft={onDiscardDraft} />);
}

describe("DraftBar discard", () => {
    it("keeps the confirm dialog open with the error inside it when the discard fails", async () => {
        bar(async () => "Не вдалося скасувати зміни");
        fireEvent.click(screen.getByRole("button", {name: t("manage.editor.draft.discard")}));
        const dialog = screen.getByRole("alertdialog");
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: t("manage.editor.draft.discard")}).at(-1)!);});
        expect(dialog.hasAttribute("open")).toBe(true);
        expect(screen.getByRole("alert").textContent).toBe("Не вдалося скасувати зміни");
    });

    it("closes the dialog after a successful discard", async () => {
        bar(async () => null);
        fireEvent.click(screen.getByRole("button", {name: t("manage.editor.draft.discard")}));
        const dialog = screen.getByRole("alertdialog");
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: t("manage.editor.draft.discard")}).at(-1)!);});
        expect(dialog.hasAttribute("open")).toBe(false);
    });
});
