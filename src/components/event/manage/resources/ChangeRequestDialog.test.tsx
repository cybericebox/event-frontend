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

const allocated = {CPUMillicores: 2000, MemoryBytes: 8 * 1024 ** 3};

function renderForm() {
    const onSent = vi.fn();
    render(<ChangeRequestDialog eventID="e" allocated={allocated} to="2026-10-05T13:00:00Z" open onClose={vi.fn()} onSent={onSent} />);
    return onSent;
}

describe("ChangeRequestDialog", () => {
    it("has exactly the fields «На скільки більше», «Продовжити до» and «Причина»", () => {
        renderForm();
        expect(screen.getByLabelText("На скільки більше, ГБ")).toBeTruthy();
        expect(screen.getByText("Продовжити до")).toBeTruthy();
        expect(screen.getByLabelText("Причина")).toBeTruthy();
        expect(screen.queryByText(/CPU|MiB|Новий розмір/)).toBeNull();
    });

    it("shows the total before and after", async () => {
        renderForm();
        fireEvent.change(screen.getByLabelText("На скільки більше, ГБ"), {target: {value: "2"}});
        expect(await screen.findByText(/Було 8 ГБ, стане 10 ГБ/)).toBeTruthy();
    });

    it("asks for a reason before sending", async () => {
        renderForm();
        fireEvent.change(screen.getByLabelText("На скільки більше, ГБ"), {target: {value: "2"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        expect((await screen.findByRole("alert")).textContent).toContain("причину");
        expect(api.request).not.toHaveBeenCalled();
    });

    it("sends the new total and refreshes", async () => {
        api.request.mockResolvedValue(undefined);
        const onSent = renderForm();
        fireEvent.change(screen.getByLabelText("На скільки більше, ГБ"), {target: {value: "2"}});
        fireEvent.change(screen.getByLabelText("Причина"), {target: {value: "More teams"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        await waitFor(() => expect(onSent).toHaveBeenCalled());
        expect(api.request).toHaveBeenCalledWith("e", expect.objectContaining({Reason: "More teams", Size: {CPUMillicores: 2500, MemoryBytes: 10 * 1024 ** 3}}));
    });

    it("shows 72514 inline", async () => {
        api.request.mockRejectedValue(new ManageApiError(409, 2514));
        renderForm();
        fireEvent.change(screen.getByLabelText("На скільки більше, ГБ"), {target: {value: "1"}});
        fireEvent.change(screen.getByLabelText("Причина"), {target: {value: "x"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        expect((await screen.findByRole("alert")).textContent).toBe("Попередній запит ще розглядається.");
    });

    it("shows 32513 inline", async () => {
        api.request.mockRejectedValue(new ManageApiError(404, 2513));
        renderForm();
        fireEvent.change(screen.getByLabelText("На скільки більше, ГБ"), {target: {value: "1"}});
        fireEvent.change(screen.getByLabelText("Причина"), {target: {value: "x"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати запит"}));
        expect((await screen.findByRole("alert")).textContent).toBe("Для заходу ще не зарезервовано ресурси.");
    });
});
