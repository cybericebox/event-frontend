// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import type {LiveScreenSummary} from "@/api/manageLive";
import {LiveScreenPicker} from "./LiveScreenPicker";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const api = vi.hoisted(() => ({create: vi.fn(), rename: vi.fn(), duplicate: vi.fn(), remove: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(),
    createLiveScreen: api.create, renameLiveScreen: api.rename, duplicateLiveScreen: api.duplicate, deleteLiveScreen: api.remove}));

const summary = (ID: string, Name: string): LiveScreenSummary => ({ID, Name, Position: 0, Version: 1, HasDraft: false, UpdatedAt: "2026-10-22T10:00:00Z", Link: null});
const two = [summary("a", "Екран 1"), summary("b", "Бокові")];

afterEach(cleanup);
beforeEach(() => Object.values(api).forEach(fn => fn.mockReset()));

function mount(screens = two, onChanged = vi.fn()) {
    render(<LiveScreenPicker eventID="e" screens={screens} max={10} currentID="a" disabled={false} onSwitch={vi.fn()} onChanged={onChanged} />);
    return onChanged;
}

describe("live screen picker", () => {
    it("creates a screen and opens it", async () => {
        api.create.mockResolvedValue(summary("c", "Екран 2"));
        const onChanged = mount();
        fireEvent.click(screen.getByRole("button", {name: /Новий екран/}));
        await waitFor(() => expect(onChanged).toHaveBeenCalledWith("c"));
        expect(api.create).toHaveBeenCalledWith("e");
    });

    it("stops at the maximum and never deletes the only screen", () => {
        mount([summary("a", "Екран 1")]);
        expect(screen.queryByRole("button", {name: "Видалити екран"})).toBeNull();
        cleanup();
        render(<LiveScreenPicker eventID="e" screens={two} max={2} currentID="a" disabled={false} onSwitch={vi.fn()} onChanged={vi.fn()} />);
        expect((screen.getByRole("button", {name: /Новий екран/}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("renames with the error beside the empty name", async () => {
        api.rename.mockResolvedValue(summary("a", "Головний"));
        const onChanged = mount();
        fireEvent.click(screen.getByRole("button", {name: "Перейменувати екран"}));
        const input = screen.getByLabelText("Назва екрана");
        fireEvent.change(input, {target: {value: "  "}});
        expect(input.getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByText("Вкажіть назву екрана")).toBeTruthy();
        fireEvent.change(input, {target: {value: " Головний "}});
        fireEvent.click(screen.getByRole("button", {name: /Зберегти/}));
        await waitFor(() => expect(api.rename).toHaveBeenCalledWith("e", "a", "Головний"));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it("deletes after the confirmation and opens the remaining screen", async () => {
        api.remove.mockResolvedValue(undefined);
        const onChanged = mount();
        fireEvent.click(screen.getByRole("button", {name: "Видалити екран"}));
        fireEvent.click(screen.getByRole("button", {name: /^Видалити$/}));
        await waitFor(() => expect(onChanged).toHaveBeenCalledWith("b"));
        expect(api.remove).toHaveBeenCalledWith("e", "a");
    });
});
