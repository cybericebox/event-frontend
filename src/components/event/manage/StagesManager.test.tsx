// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ManageLifecycle} from "@/api/manage";
import type {ManageStage} from "@/api/manageStages";

const api = vi.hoisted(() => ({list: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), toastError: vi.fn(), toastOk: vi.fn()}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {error: api.toastError, success: api.toastOk}}));
vi.mock("@/api/manageStages", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/manageStages")>(),
    getManageStages: (...args: unknown[]) => api.list(...args),
    updateManageStage: (...args: unknown[]) => api.update(...args),
    createManageStage: (...args: unknown[]) => api.create(...args),
    deleteManageStage: (...args: unknown[]) => api.remove(...args),
}));

const {StagesManager} = await import("./StagesManager");
const {ManageApiError} = await import("@/api/manage");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); Object.values(api).forEach(mock => mock.mockReset());});

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stage = (n: number, extra: Partial<ManageStage> = {}): ManageStage => ({
    ID: id(n), Name: `Етап ${n}`, OpensAt: `2026-10-0${n}T10:00:00Z`, ClosesAt: `2026-10-0${n}T12:00:00Z`, Returnable: false,
    LabRetentionMinutes: null, State: "upcoming", First: false, Last: false, DeployLeadMinutes: 0, ...extra,
});
const lifecycle = {Configured: true, StartAt: "2026-10-01T10:00:00Z", FinishAt: "2026-10-03T12:00:00Z"} as ManageLifecycle;

function renderManager(canManage = true) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={lifecycle} canManage={canManage} /></QueryClientProvider>);
}
const row = (name: string) => screen.getByRole("listitem", {name: `Етап «${name}»`});
const switchOf = (name: string) => within(row(name)).getByRole("switch", {name: "Можна повернутися"}) as HTMLInputElement;

describe("the stages block", () => {
    it("shows the empty state and the form for the first stage with the event's own times", async () => {
        api.list.mockResolvedValue([]);
        renderManager();
        expect(await screen.findByText("Етапів немає: усі завдання доступні впродовж усього заходу.")).toBeTruthy();
        expect(screen.getByText("Перший етап охоплює весь захід: початок і завершення беруться з розкладу.")).toBeTruthy();
    });

    it("asks for a scheduled finish before stages can be added", async () => {
        api.list.mockResolvedValue([]);
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={{...lifecycle, FinishAt: null}} canManage /></QueryClientProvider>);
        expect(await screen.findByText(/Етапи потребують запланованого завершення заходу/)).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Додати етап"})).toBeNull();
    });

    it("locks what a state does not allow: a closed stage keeps only its name", async () => {
        api.list.mockResolvedValue([stage(1, {State: "closed", First: true}), stage(2, {State: "open"}), stage(3, {Last: true})]);
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        expect(switchOf("Етап 1").disabled).toBe(true);
        expect(within(row("Етап 1")).getByText("Закрито")).toBeTruthy();
        expect((within(row("Етап 1")).getByRole("textbox", {name: /Назва/}) as HTMLInputElement).disabled).toBe(false);
        expect(switchOf("Етап 2").disabled).toBe(false);
        // an open stage can be closed now but never deleted; an upcoming one can be deleted but not closed
        expect(within(row("Етап 2")).getByRole("button", {name: "Закрити зараз"})).toBeTruthy();
        expect(within(row("Етап 2")).queryByRole("button", {name: "Видалити"})).toBeNull();
        expect(within(row("Етап 3")).getByRole("button", {name: "Видалити"})).toBeTruthy();
        expect(within(row("Етап 3")).queryByRole("button", {name: "Закрити зараз"})).toBeNull();
    });

    it("flips «Можна повернутися» at once, before the server answers, and never waits for it", async () => {
        api.list.mockResolvedValue([stage(1, {State: "open", First: true}), stage(2, {Last: true})]);
        let finish: (value: ManageStage) => void = () => {};
        api.update.mockImplementation(() => new Promise<ManageStage>(resolve => {finish = resolve;}));
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        await act(async () => {fireEvent.click(switchOf("Етап 1"));});
        // the server has not answered (its promise is still pending), yet the choice is shown
        await waitFor(() => expect(switchOf("Етап 1").checked).toBe(true));
        // a pending save disables no control, not even the same one
        expect(switchOf("Етап 1").disabled).toBe(false);
        expect(switchOf("Етап 2").disabled).toBe(false);
        expect(api.update).toHaveBeenCalledWith("e1", id(1), {Returnable: true, LabRetentionMinutes: null});
        await act(async () => {finish(stage(1, {State: "open", First: true, Returnable: true}));});
        expect(switchOf("Етап 1").checked).toBe(true);
    });

    it("rolls the switch back with the reason when the server refuses", async () => {
        api.list.mockResolvedValueOnce([stage(1, {State: "open", First: true})]);
        api.update.mockRejectedValue(new ManageApiError(409, 1148));
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        api.list.mockResolvedValue([stage(1, {State: "closed", First: true})]);
        await act(async () => {fireEvent.click(switchOf("Етап 1"));});
        await waitFor(() => expect(api.toastError).toHaveBeenCalledWith("Етап закрито, його не можна змінювати"));
        await waitFor(() => expect(switchOf("Етап 1").checked).toBe(false));
    });

    it("closes an open stage only after the confirmation, with the danger button", async () => {
        api.list.mockResolvedValue([stage(1, {State: "open", First: true, Last: true})]);
        api.update.mockResolvedValue(stage(1, {State: "closed", First: true, Last: true}));
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        fireEvent.click(within(row("Етап 1")).getByRole("button", {name: "Закрити зараз"}));
        expect(screen.getByText("Закрити етап «Етап 1» зараз?")).toBeTruthy();
        expect(api.update).not.toHaveBeenCalled();
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Закрити"}));});
        expect(api.update).toHaveBeenCalledWith("e1", id(1), {CloseNow: true});
    });

    it("deletes an upcoming stage after the confirmation", async () => {
        api.list.mockResolvedValue([stage(1, {First: true}), stage(2, {Last: true})]);
        api.remove.mockResolvedValue(undefined);
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 2»"});
        fireEvent.click(within(row("Етап 2")).getByRole("button", {name: "Видалити"}));
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: "Видалити"}).at(-1)!);});
        expect(api.remove).toHaveBeenCalledWith("e1", id(2));
    });

    it("warns when a break is shorter than the lead the platform computes", async () => {
        api.list.mockResolvedValue([stage(1, {ClosesAt: "2026-10-01T12:00:00Z", First: true}), stage(2, {OpensAt: "2026-10-01T12:03:00Z", DeployLeadMinutes: 15, Last: true})]);
        renderManager();
        expect(await screen.findByText(/коротша за 15 хв/)).toBeTruthy();
    });

    it("is read-only for a viewer", async () => {
        api.list.mockResolvedValue([stage(1, {First: true, Last: true})]);
        renderManager(false);
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        expect(switchOf("Етап 1").disabled).toBe(true);
        expect(screen.queryByRole("button", {name: "Видалити"})).toBeNull();
        expect(screen.queryByRole("button", {name: "Додати етап"})).toBeNull();
    });
});


it("queues retention with Returnable, keeps both controls enabled and never applies a stale stage reply", async () => {
    const original = stage(1, {State: "open", First: true, LabRetentionMinutes: null});
    api.list.mockResolvedValue([original]);
    const finishes: ((value: ManageStage) => void)[] = [];
    api.update.mockImplementation(() => new Promise<ManageStage>(resolve => {finishes.push(resolve);}));
    renderManager(); await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    fireEvent.click(switchOf("Етап 1"));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const retention = within(row("Етап 1")).getByLabelText("Зберігати зупинене середовище (хвилини)") as HTMLInputElement;
    fireEvent.change(retention, {target: {value: "0"}}); fireEvent.blur(retention);
    expect(retention.value).toBe("0"); expect(retention.disabled).toBe(false); expect(switchOf("Етап 1").disabled).toBe(false);
    expect(api.update).toHaveBeenCalledTimes(1);
    await act(async () => {finishes[0]({...original, Returnable: true});});
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    expect(api.update.mock.calls[1]).toEqual(["e1", id(1), {Returnable: true, LabRetentionMinutes: 0}]);
    expect(retention.value).toBe("0"); expect(switchOf("Етап 1").checked).toBe(true);
    await act(async () => {finishes[1]({...original, Returnable: true, LabRetentionMinutes: 0});});
    fireEvent.change(retention, {target: {value: ""}}); fireEvent.keyDown(retention, {key: "Enter"});
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(3));
    expect(api.update.mock.calls[2][2]).toEqual({Returnable: true, LabRetentionMinutes: null});
});
it("lets a manager edit retention on a closed stage while preserving its Returnable and time locks", async () => {
    api.list.mockResolvedValue([stage(1, {State: "closed", First: true, Last: true, LabRetentionMinutes: 40})]);
    api.update.mockImplementation(() => new Promise(() => {}));
    renderManager(); await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    const retention = within(row("Етап 1")).getByLabelText("Зберігати зупинене середовище (хвилини)") as HTMLInputElement;
    expect(retention.disabled).toBe(false); expect(switchOf("Етап 1").disabled).toBe(true);
    fireEvent.change(retention, {target: {value: "10081"}}); fireEvent.blur(retention);
    expect(api.update).not.toHaveBeenCalled();
    expect(within(row("Етап 1")).getByText("Введіть ціле число від 0 до 10080.")).toBeTruthy();
});
