// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ManageLifecycle} from "@/api/manage";
import type {ManageStage} from "@/api/manageStages";

const api = vi.hoisted(() => ({list: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), toastError: vi.fn(), toastOk: vi.fn()}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/components/event/manage/ManageDateField", () => ({ManageDateField: ({id, title, value, onChange, disabled}: {id: string; title: string; value: string; onChange: (value: string) => void; disabled: boolean}) => <input id={id} aria-label={title} value={value} disabled={disabled} onChange={change => onChange(change.target.value)} />}));
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
    LabRetentionMinutes: null, OpensWithEvent: false, ClosesWithEvent: false, State: "upcoming", First: false, Last: false, DeployLeadMinutes: 0, ...extra,
});
const lifecycle = {Configured: true, StartAt: "2026-10-01T10:00:00Z", FinishAt: "2026-10-03T12:00:00Z"} as ManageLifecycle;

function renderManager(canManage = true) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={lifecycle} canManage={canManage} /></QueryClientProvider>);
}
const row = (name: string) => screen.getByRole("listitem", {name: `Етап «${name}»`});
const switchOf = (name: string) => within(row(name)).getByRole("switch", {name: "Можна повернутися"}) as HTMLInputElement;

describe("the stages block", () => {
    it("asks for explicit dates on the first stage without needing an event finish", async () => {
        api.list.mockResolvedValue([]);
        api.create.mockResolvedValue(stage(1));
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={{...lifecycle, FinishAt: null}} canManage /></QueryClientProvider>);
        fireEvent.click(await screen.findByRole("button", {name: "Додати етап"}));
        const form = await screen.findByRole("form", {name: "Новий етап"});
        const opens = within(form).getByLabelText("Відкривається") as HTMLInputElement;
        const closes = within(form).getByLabelText("Закривається") as HTMLInputElement;
        expect(opens.disabled).toBe(false);
        expect(opens.value).toBe("");
        expect(closes.value).toBe("");
        const add = within(form).getByRole("button", {name: "Додати етап"});
        fireEvent.change(within(form).getByRole("textbox", {name: /Назва/}), {target: {value: "Практика"}});
        fireEvent.change(opens, {target: {value: "2026-10-01T13:00"}});
        expect((add as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(closes, {target: {value: "2026-10-01T14:00"}});
        fireEvent.click(add);
        await waitFor(() => expect(api.create).toHaveBeenCalledWith("e1", {
            Name: "Практика", OpensAt: new Date("2026-10-01T13:00").toISOString(),
            ClosesAt: new Date("2026-10-01T14:00").toISOString(), Returnable: false, OpensWithEvent: false, ClosesWithEvent: false,
        }));
    });

    it("saves the first and last stage's own dates", async () => {
        api.list.mockResolvedValue([stage(1, {First: true, Last: true})]);
        api.update.mockResolvedValue(stage(1));
        renderManager();
        const first = await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        const opens = within(first).getByLabelText("Відкривається") as HTMLInputElement;
        const closes = within(first).getByLabelText("Закривається") as HTMLInputElement;
        expect(opens.disabled).toBe(false);
        expect(closes.disabled).toBe(false);
        fireEvent.change(opens, {target: {value: "2026-10-01T14:00"}});
        fireEvent.change(closes, {target: {value: "2026-10-01T16:00"}});
        fireEvent.click(within(first).getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(api.update).toHaveBeenCalledWith("e1", id(1), {
            Name: "Етап 1", OpensAt: new Date("2026-10-01T14:00").toISOString(), ClosesAt: new Date("2026-10-01T16:00").toISOString(), OpensWithEvent: false, ClosesWithEvent: false,
        }));
    });

    it("explains the selected returnable state and keeps field help reachable on closed stages", async () => {
        api.list.mockResolvedValue([stage(1, {State: "closed", Returnable: true}), stage(2)]);
        api.update.mockImplementation(() => new Promise(() => {}));
        renderManager();
        const closed = await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        expect(within(closed).getByText(/для практики/, {selector: "p"})).toBeTruthy();
        expect(within(row("Етап 2")).getByText(/недоступні/, {selector: "p"})).toBeTruthy();
        fireEvent.click(switchOf("Етап 2"));
        await waitFor(() => expect(within(row("Етап 2")).getByText(/для практики/, {selector: "p"})).toBeTruthy());
        const help = within(closed).getByRole("button", {name: "Про поле «Можна повернутися»"});
        expect(help.closest("label")).toBeNull();
        expect((help as HTMLButtonElement).disabled).toBe(false);
        fireEvent.focus(help);
        expect(document.getElementById(help.getAttribute("aria-describedby")!)?.getAttribute("role")).toBe("tooltip");
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
        expect(api.update).toHaveBeenCalledWith("e1", id(1), {Returnable: true});
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

    it("says «видалити», not «зберегти», when deleting a stage fails", async () => {
        api.list.mockResolvedValue([stage(1, {First: true}), stage(2, {Last: true})]);
        api.remove.mockRejectedValue(new Error("network"));
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 2»"});
        fireEvent.click(within(row("Етап 2")).getByRole("button", {name: "Видалити"}));
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: "Видалити"}).at(-1)!);});
        expect(await screen.findByText("Не вдалося видалити етап")).toBeTruthy();
        expect(screen.queryByText("Не вдалося зберегти етап")).toBeNull();
    });

    it("says «закрити» when closing a stage now fails", async () => {
        api.list.mockResolvedValue([stage(1, {State: "open", First: true, Last: true})]);
        api.update.mockRejectedValue(new Error("network"));
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        fireEvent.click(within(row("Етап 1")).getByRole("button", {name: "Закрити зараз"}));
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Закрити"}));});
        expect(await screen.findByText("Не вдалося закрити етап")).toBeTruthy();
    });

    it("says that «Можна повернутися» is saved at once, unlike the dates behind «Зберегти»", async () => {
        api.list.mockResolvedValue([stage(1, {First: true, Last: true})]);
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        expect(within(row("Етап 1")).getByText("Зберігається одразу.")).toBeTruthy();
    });

    it("keeps the new-stage form closed behind «Додати етап» until asked, and «Скасувати» closes it", async () => {
        api.list.mockResolvedValue([stage(1, {First: true, Last: true})]);
        renderManager();
        await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
        expect(screen.queryByRole("form", {name: "Новий етап"})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Додати етап"}));
        const form = screen.getByRole("form", {name: "Новий етап"});
        expect(within(form).getByRole("textbox", {name: /Назва/})).toBeTruthy();
        fireEvent.click(within(form).getByRole("button", {name: "Скасувати"}));
        expect(screen.queryByRole("form", {name: "Новий етап"})).toBeNull();
        expect(screen.getByRole("button", {name: "Додати етап"})).toBeTruthy();
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


// Labs live only until the reservation window ends: the stage offers no retention setting and never sends one.
it("offers no retention setting on a stage", async () => {
    api.list.mockResolvedValue([stage(1, {State: "open", First: true, LabRetentionMinutes: 40})]);
    api.update.mockImplementation(() => new Promise(() => {}));
    renderManager(); await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    expect(within(row("Етап 1")).queryByLabelText("Зберігати зупинене середовище (хвилини)")).toBeNull();
    fireEvent.click(switchOf("Етап 1"));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("e1", id(1), {Returnable: true}));
});

it("keeps a pending switch through explicit form-save cache publication", async () => {
    const original = stage(1, {State: "open"});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    api.list.mockResolvedValue([original]);
    let finish!: (value: ManageStage) => void;
    api.update.mockImplementationOnce(() => new Promise<ManageStage>(resolve => {finish = resolve;}));
    api.update.mockResolvedValueOnce({...original, Name: "Нова назва"});
    render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={lifecycle} canManage /></QueryClientProvider>);
    await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    fireEvent.click(switchOf("Етап 1"));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    fireEvent.change(within(row("Етап 1")).getByRole("textbox", {name: /Назва/}), {target: {value: "Нова назва"}});
    fireEvent.click(within(row("Етап 1")).getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    expect(api.list).toHaveBeenCalledTimes(1);
    // The saved name is published, the pending switch is kept.
    await waitFor(() => expect(switchOf("Нова назва").checked).toBe(true));
    await act(async () => {finish({...original, Name: "Нова назва", Returnable: true});});
});

it("a GET started during a switch save cannot undo its acknowledgement when it finishes late", async () => {
    const original = stage(1, {State: "open"});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    let getFinish!: (rows: ManageStage[]) => void;
    api.list.mockResolvedValueOnce([original]).mockImplementationOnce(() => new Promise<ManageStage[]>(resolve => {getFinish = resolve;}));
    let putFinish!: (row: ManageStage) => void;
    api.update.mockImplementationOnce(() => new Promise<ManageStage>(resolve => {putFinish = resolve;}));
    render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={lifecycle} canManage /></QueryClientProvider>);
    await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    fireEvent.click(switchOf("Етап 1"));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const refresh = client.refetchQueries({queryKey: ["event-management-stages", "e1"], exact: true});
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    await act(async () => {putFinish({...original, Returnable: true});});
    await act(async () => {getFinish([original]); await refresh;});
    expect(switchOf("Етап 1").checked).toBe(true);
});

it("offers explicit event or custom sources, follows changed event dates, and keeps clean Save visible disabled", async () => {
    api.list.mockResolvedValue([stage(1, {First: true, Last: true})]);
    api.create.mockResolvedValue(stage(2));
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const {rerender} = render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={lifecycle} canManage /></QueryClientProvider>);
    const first = await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    expect((within(first).getByRole("button", {name: "Зберегти"}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", {name: "Додати етап"}));
    const form = screen.getByRole("form", {name: "Новий етап"});
    fireEvent.change(within(form).getByRole("textbox", {name: /Назва/}), {target: {value: "Прив’язаний"}});
    fireEvent.click(within(form).getByRole("radio", {name: "Початок заходу"}));
    fireEvent.click(within(form).getByRole("radio", {name: "Завершення заходу"}));
    expect((within(form).getByLabelText("Відкривається") as HTMLInputElement).disabled).toBe(true);
    const moved = {...lifecycle, StartAt: "2026-10-01T11:00:00Z", FinishAt: "2026-10-03T13:00:00Z"};
    rerender(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={moved} canManage /></QueryClientProvider>);
    fireEvent.click(within(form).getByRole("button", {name: "Додати етап"}));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("e1", {Name: "Прив’язаний", OpensAt: moved.StartAt, ClosesAt: moved.FinishAt, Returnable: false, OpensWithEvent: true, ClosesWithEvent: true}));
});

it("explains why binding to an absent event finish is unavailable while custom closing remains editable", async () => {
    api.list.mockResolvedValue([]);
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><StagesManager eventID="e1" lifecycle={{...lifecycle, FinishAt: null}} canManage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", {name: "Додати етап"}));
    const form = await screen.findByRole("form", {name: "Новий етап"});
    expect((within(form).getByRole("radio", {name: "Завершення заходу"}) as HTMLInputElement).disabled).toBe(true);
    expect((within(form).getByLabelText("Закривається") as HTMLInputElement).disabled).toBe(false);
    expect(within(form).getByText(/Власний час закриття можна задати без нього/)).toBeTruthy();
});

it("saving only an opening source choice is dirty even when its date equals the event start", async () => {
    const original = stage(1, {First: true, Last: true});
    api.list.mockResolvedValue([original]);
    api.update.mockResolvedValue({...original, OpensWithEvent: true});
    renderManager();
    const first = await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    const save = within(first).getByRole("button", {name: "Зберегти"}) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(within(first).getByRole("radio", {name: "Початок заходу"}));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("e1", id(1), {Name: "Етап 1", OpensWithEvent: true, ClosesWithEvent: false, ClosesAt: "2026-10-01T12:00:00Z"}));
});

it("an older instant-control reply cannot undo a newly saved closing source", async () => {
    const original = stage(1, {State: "open"});
    const bound = {...original, ClosesWithEvent: true, ClosesAt: lifecycle.FinishAt!};
    api.list.mockResolvedValue([original]);
    let finish!: (row: ManageStage) => void;
    api.update.mockImplementationOnce(() => new Promise<ManageStage>(resolve => {finish = resolve;})).mockResolvedValueOnce(bound);
    renderManager();
    const first = await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    fireEvent.click(switchOf("Етап 1"));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    fireEvent.click(within(first).getByRole("radio", {name: "Завершення заходу"}));
    fireEvent.click(within(first).getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((within(first).getByRole("button", {name: "Зберегти"}) as HTMLButtonElement).disabled).toBe(true));
    await act(async () => {finish({...original, Returnable: true});});
    await waitFor(() => expect((within(first).getByRole("radio", {name: "Завершення заходу"}) as HTMLInputElement).checked).toBe(true));
    expect(switchOf("Етап 1").checked).toBe(true);
});

it("a name or source save preserves untouched custom date precision", async () => {
    const original = stage(1, {OpensAt: "2026-10-01T10:00:37.123Z", ClosesAt: "2026-10-01T12:00:42.456Z"});
    api.list.mockResolvedValue([original]);
    api.update.mockResolvedValue({...original, Name: "Точний час"});
    renderManager();
    const first = await screen.findByRole("listitem", {name: "Етап «Етап 1»"});
    fireEvent.change(within(first).getByRole("textbox", {name: /Назва/}), {target: {value: "Точний час"}});
    fireEvent.click(within(first).getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("e1", id(1), {Name: "Точний час", OpensAt: original.OpensAt, ClosesAt: original.ClosesAt, OpensWithEvent: false, ClosesWithEvent: false}));
});
