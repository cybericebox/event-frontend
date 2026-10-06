// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {ConfirmDialog} from "./ConfirmDialog";

// jsdom has no top-layer dialog.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete the team?" description="All results will be lost." subject="Frost Byte"
        confirmLabel="Delete" tone="danger" onCancel={onCancel} onConfirm={onConfirm} {...props} />);
    return {onCancel, onConfirm};
}

describe("ConfirmDialog", () => {
    it("focuses Cancel first and makes the danger action the solid danger button", () => {
        setup();
        expect(document.activeElement?.textContent).toBe("Скасувати");
        expect(screen.getByRole("button", {name: "Delete"}).className).toContain("ib-btn--danger-solid");
        expect(screen.getByText("Frost Byte").className).toBe("event-confirm__subject");
    });

    it("uses the primary button for a non-destructive confirmation", () => {
        setup({tone: "default"});
        expect(screen.getByRole("button", {name: "Delete"}).className).toContain("ib-btn--primary");
    });

    it("confirms on the action and cancels on Esc before any parent layer sees it", () => {
        const parent = vi.fn();
        document.addEventListener("keydown", parent, true);
        const {onCancel, onConfirm} = setup();
        fireEvent.click(screen.getByRole("button", {name: "Delete"}));
        expect(onConfirm).toHaveBeenCalledOnce();
        fireEvent.keyDown(document.body, {key: "Escape"});
        expect(onCancel).toHaveBeenCalledOnce();
        expect(parent).not.toHaveBeenCalled();
        document.removeEventListener("keydown", parent, true);
    });

    it("stays open while busy, shows the busy mark and an inline error", () => {
        const {onCancel} = setup({busy: true, error: "Failed"});
        const action = screen.getByRole("button", {name: /Delete/});
        expect(action.getAttribute("aria-busy")).toBe("true");
        expect(action.querySelector(".ib-busy-mark")).not.toBeNull();
        expect(screen.getByRole("alert").textContent).toBe("Failed");
        fireEvent.keyDown(document.body, {key: "Escape"});
        expect(onCancel).not.toHaveBeenCalled();
    });
});
