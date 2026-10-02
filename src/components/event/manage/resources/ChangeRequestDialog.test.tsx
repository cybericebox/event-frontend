// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {ManageApiError} from "@/api/manage";
import {ChangeRequestDialog} from "./ChangeRequestDialog";

const api = vi.hoisted(() => ({request: vi.fn()}));
vi.mock("@/api/manageResources", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResources")>(), requestResourceChange: api.request}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function renderForm() {
    const onSent = vi.fn();
    render(<ChangeRequestDialog eventID="e" open onClose={vi.fn()} onSent={onSent} />);
    return onSent;
}

describe("ChangeRequestDialog", () => {
    it("asks for a reason before sending", async () => {
        renderForm();
        fireEvent.change(document.getElementById("resources-size-cpu")!, {target: {value: "2000"}});
        fireEvent.change(document.getElementById("resources-size-memory")!, {target: {value: "4096"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        expect((await screen.findByRole("alert")).textContent).toContain("причину");
        expect(api.request).not.toHaveBeenCalled();
    });

    it("sends the request and refreshes", async () => {
        api.request.mockResolvedValue(undefined);
        const onSent = renderForm();
        fireEvent.change(document.getElementById("resources-size-cpu")!, {target: {value: "2000"}});
        fireEvent.change(document.getElementById("resources-size-memory")!, {target: {value: "4096"}});
        fireEvent.change(document.getElementById("resources-reason")!, {target: {value: "More teams"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        await waitFor(() => expect(onSent).toHaveBeenCalled());
        expect(api.request).toHaveBeenCalledWith("e", expect.objectContaining({Reason: "More teams", Size: {CPUMillicores: 2000, MemoryBytes: 4096 * 1024 ** 2}}));
    });

    it("shows 72514 inline", async () => {
        api.request.mockRejectedValue(new ManageApiError(409, 2514));
        renderForm();
        fireEvent.change(document.getElementById("resources-dynamic-cpu")!, {target: {value: "500"}});
        fireEvent.change(document.getElementById("resources-dynamic-memory")!, {target: {value: "512"}});
        fireEvent.change(document.getElementById("resources-reason")!, {target: {value: "x"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        expect((await screen.findByRole("alert")).textContent).toBe("Попередній запит ще розглядається.");
    });

    it("shows 32513 inline", async () => {
        api.request.mockRejectedValue(new ManageApiError(404, 2513));
        renderForm();
        fireEvent.change(document.getElementById("resources-dynamic-cpu")!, {target: {value: "500"}});
        fireEvent.change(document.getElementById("resources-dynamic-memory")!, {target: {value: "512"}});
        fireEvent.change(document.getElementById("resources-reason")!, {target: {value: "x"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        expect((await screen.findByRole("alert")).textContent).toBe("Для заходу ще не зарезервовано ресурси.");
    });
});
