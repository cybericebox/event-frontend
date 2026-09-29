// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {TemplateActions} from "./TemplateActions";
import type {TemplateMode} from "./notificationModel";

afterEach(cleanup);

// jsdom has no <dialog> behaviour.
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {this.removeAttribute("open");};
});

function setup(mode: TemplateMode, onReset = vi.fn().mockResolvedValue(true)) {
    const handlers = {onCustomize: vi.fn(), onEdit: vi.fn(), onRestore: vi.fn(), onReset};
    render(<TemplateActions mode={mode} status="Опублікована" canManage busy={false} {...handlers} />);
    return handlers;
}

describe("TemplateActions", () => {
    it("offers only «Налаштувати для заходу» on the platform template", () => {
        const handlers = setup("platform");
        expect(screen.queryByRole("button", {name: /Повернути стандартний/})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Налаштувати для заходу"}));
        expect(handlers.onCustomize).toHaveBeenCalled();
    });

    it("edits a published copy through a draft", () => {
        const handlers = setup("view");
        fireEvent.click(screen.getByRole("button", {name: /Редагувати/}));
        expect(handlers.onEdit).toHaveBeenCalled();
    });

    it("restores an older version as a draft", () => {
        const handlers = setup("previous");
        fireEvent.click(screen.getByRole("button", {name: "Відновити як чернетку"}));
        expect(handlers.onRestore).toHaveBeenCalled();
    });

    it("shows nothing without a template", () => {
        setup("none");
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("returns to the standard template only after a confirmation", async () => {
        const handlers = setup("edit");
        fireEvent.click(screen.getByRole("button", {name: /Повернути стандартний/}));
        expect(handlers.onReset).not.toHaveBeenCalled();
        const dialog = screen.getByRole("alertdialog", {hidden: true});
        expect(dialog.textContent).toContain("Повернути стандартний шаблон?");
        fireEvent.click(screen.getAllByRole("button", {name: "Повернути стандартний", hidden: true}).at(-1)!);
        await waitFor(() => expect(handlers.onReset).toHaveBeenCalledTimes(1));
    });

    it("keeps the template when the confirmation is cancelled", () => {
        const handlers = setup("edit");
        fireEvent.click(screen.getByRole("button", {name: /Повернути стандартний/}));
        fireEvent.click(screen.getByRole("button", {name: "Скасувати", hidden: true}));
        expect(handlers.onReset).not.toHaveBeenCalled();
    });
});
