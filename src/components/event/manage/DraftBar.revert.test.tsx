// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {DraftBar} from "./DraftBar";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("DraftBar «Скасувати» for unsaved edits", () => {
    it("asks before dropping the edits and keeps them on cancel", () => {
        const revert = vi.fn();
        render(<DraftBar state={{dirty: true, hasDraft: false, published: true}} busy={null} canManage invalid={false} onSave={vi.fn()} onPublish={vi.fn()} onRevertLocal={revert} />);
        fireEvent.click(screen.getByRole("button", {name: "Скасувати"}));
        expect(revert).not.toHaveBeenCalled();
        const dialog = screen.getByText("Відкинути незбережені зміни?").closest("dialog")!;
        fireEvent.click(within(dialog).getByRole("button", {name: "Скасувати"}));
        expect(revert).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", {name: "Скасувати"}));
        fireEvent.click(within(screen.getByText("Відкинути незбережені зміни?").closest("dialog")!).getByRole("button", {name: "Відкинути зміни"}));
        expect(revert).toHaveBeenCalledOnce();
    });
});
