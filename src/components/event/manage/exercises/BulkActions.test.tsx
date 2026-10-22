// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {EventExerciseAttachment} from "@/api/manageChallenges";

const api = vi.hoisted(() => ({visibility: vi.fn(), scoring: vi.fn(), detach: vi.fn(), board: vi.fn(), attachments: vi.fn()}));
const manager = vi.hoisted(() => ({canManage: true}));
vi.mock("@/api/manageChallenges", () => ({
    bulkSetEventExerciseVisibility: api.visibility, bulkSetEventExerciseScoring: api.scoring, bulkDetachEventExercises: api.detach,
    getEventBoardChallenges: api.board, getEventExerciseAttachments: api.attachments,
    updateEventExercise: vi.fn(), forkEventExercise: vi.fn(), revertEventExercise: vi.fn(), detachEventExercise: vi.fn(),
}));
vi.mock("@/api/manage", async () => ({
    ...(await vi.importActual<typeof import("@/api/manage")>("@/api/manage")),
    getManageConfig: async () => ({HintsDisabled: false, InfrastructureAllowed: true, MaxFlagAttempts: null}),
    getManageLifecycle: async () => ({Status: "not_published", JoinPolicy: 0, FinishAt: null}),
    getManageScoring: async () => ({ForceEventScoring: false}),
}));
vi.mock("@/api/manageLabs", () => ({getManageLabs: async () => ({})}));
vi.mock("@/api/manageStages", () => ({getManageStages: async () => []}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1"}, canManage: manager.canManage})}));

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const attachment = (n: number, extra: Partial<EventExerciseAttachment> = {}) => ({ID: ID(n), ExerciseName: `Set ${n}`, ExerciseID: `x${n}`, VersionNumber: 1, LatestVersionNumber: 1,
    UpdateAvailable: false, Status: 0, Revision: 0, Resources: null, ChallengeCount: 1, VariantCount: 1, HasAttempts: false, FlagsRepeat: null, AvgDifficulty: null, TaskCount: null, TaskNames: [], ...extra}) as unknown as EventExerciseAttachment;
const sets = [attachment(1), attachment(2, {HasAttempts: true}), attachment(3)].map(item => ({attachment: item, challenges: []}));
vi.mock("./useBoardSets", () => ({
    useBoardSets: () => ({attachments: {data: sets.map(set => set.attachment)}, groups: {data: []}, sets: {data: sets}, pending: false, failed: false, error: null,
        retry: vi.fn(), refreshSets: vi.fn(), refreshGroups: vi.fn(), refreshAll: vi.fn()}),
}));
vi.mock("./useBoardMutations", () => ({useBoardMutations: () => ({setPublished: vi.fn(), setHintsEnabled: vi.fn(), setMaxFlagAttempts: vi.fn()})}));
vi.mock("./ResourcePlanSummary", () => ({ResourcePlanSummary: () => null}));
vi.mock("./TaskRow", async () => ({...(await vi.importActual<object>("./TaskRow")), TaskRow: () => null, HintMark: () => null}));

import {ExerciseAttachments} from "./ExerciseAttachments";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); vi.resetAllMocks(); manager.canManage = true;});

const ok = (ids: string[]) => ({Changed: ids.length, Skipped: 0, Results: ids.map(id => ({ID: id, Changed: true}))});
function setup() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ExerciseAttachments /></QueryClientProvider>);
}
async function selectAll() {
    setup();
    fireEvent.click(await screen.findByRole("checkbox", {name: "Вибрати всі"}));
    return screen.getByRole("region", {name: "Дії з вибраними завданнями"});
}

describe("bulk actions on the event's tasks", () => {
    it("selects rows one by one, shows «select all» as indeterminate, then selects every set", async () => {
        setup();
        const all = await screen.findByRole("checkbox", {name: "Вибрати всі"}) as HTMLInputElement;
        expect(screen.queryByRole("region", {name: "Дії з вибраними завданнями"})).toBeNull();
        fireEvent.click(screen.getByRole("checkbox", {name: "Вибрати «Set 1»"}));
        expect(all.indeterminate).toBe(true);
        expect(screen.getByText("Вибрано 1 завдання")).toBeTruthy();
        fireEvent.click(all);
        expect(all.checked).toBe(true);
        expect(all.indeterminate).toBe(false);
        expect(screen.getByText("Вибрано 3 завдання")).toBeTruthy();
        fireEvent.click(all);
        expect(screen.queryByRole("region", {name: "Дії з вибраними завданнями"})).toBeNull();
    });

    it("shows and hides every selected set and reports the totals", async () => {
        api.visibility.mockImplementation(async (_: string, ids: string[]) => ok(ids));
        const bar = await selectAll();
        await act(async () => {fireEvent.click(within(bar).getByRole("button", {name: /Показати учасникам/}));});
        expect(api.visibility).toHaveBeenCalledWith("e1", [ID(1), ID(2), ID(3)], true);
        expect(await within(bar).findByText("Змінено 3. Пропущено 0.")).toBeTruthy();
        await act(async () => {fireEvent.click(within(bar).getByRole("button", {name: /Сховати від учасників/}));});
        expect(api.visibility).toHaveBeenLastCalledWith("e1", [ID(1), ID(2), ID(3)], false);
    });

    it("counts the progress in the busy button", async () => {
        let finish!: (value: unknown) => void;
        api.visibility.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
        const bar = await selectAll();
        const button = within(bar).getByRole("button", {name: /Показати учасникам/});
        await act(async () => {fireEvent.click(button);});
        expect(button.textContent).toContain("Публікуємо… 0/3");
        await act(async () => {finish(ok([ID(1), ID(2), ID(3)]));});
        expect(await within(bar).findByText("Змінено 3. Пропущено 0.")).toBeTruthy();
    });

    it("keeps going after a refused set and lists it with the reason", async () => {
        api.visibility.mockResolvedValue({Changed: 2, Skipped: 1, Results: [
            {ID: ID(1), Changed: true}, {ID: ID(2), Changed: false, Code: 99999, Message: "Етап уже відкрито"}, {ID: ID(3), Changed: true}]});
        const bar = await selectAll();
        await act(async () => {fireEvent.click(within(bar).getByRole("button", {name: /Показати учасникам/}));});
        expect(await within(bar).findByText("Змінено 2. Пропущено 1.")).toBeTruthy();
        expect(within(bar).getByText("«Set 2»: Етап уже відкрито")).toBeTruthy();
    });

    it("applies one scoring to every selected set from the scoring dialog", async () => {
        api.scoring.mockImplementation(async (_: string, ids: string[]) => ok(ids));
        api.board.mockResolvedValue([]);
        const bar = await selectAll();
        fireEvent.click(within(bar).getByRole("button", {name: "Система оцінювання…"}));
        const dialog = await screen.findByRole("dialog", {name: "Система оцінювання для 3 завдань"});
        await act(async () => {fireEvent.click(within(dialog).getByRole("button", {name: "Застосувати"}));});
        expect(api.scoring).toHaveBeenCalledWith("e1", [ID(1), ID(2), ID(3)], null);
        expect(await within(bar).findByText("Змінено 3. Пропущено 0.")).toBeTruthy();
    });

    it("asks before removing, names the count and lists the sets teams already answered", async () => {
        api.detach.mockImplementation(async (_: string, ids: string[]) => ok(ids));
        api.attachments.mockResolvedValue([]);
        const bar = await selectAll();
        fireEvent.click(within(bar).getByRole("button", {name: /Прибрати із заходу/}));
        expect(screen.getByText("Прибрати 3 завдання із заходу?")).toBeTruthy();
        const attempted = document.querySelector("[data-bulk-attempted]")!;
        expect(attempted.textContent).toContain("їхні результати буде втрачено");
        expect(within(attempted as HTMLElement).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Set 2"]);
        expect(api.detach).not.toHaveBeenCalled();
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Прибрати"}));});
        await waitFor(() => expect(api.detach).toHaveBeenCalledWith("e1", [ID(1), ID(2), ID(3)], true));
    });

    it("shows a viewer no checkboxes and no bar", async () => {
        manager.canManage = false;
        setup();
        await screen.findByRole("heading", {name: "Set 1"});
        expect(screen.queryByRole("checkbox")).toBeNull();
        expect(screen.queryByRole("region", {name: "Дії з вибраними завданнями"})).toBeNull();
    });
});

it("rejects bulk dynamic bounds over 999 without sending scoring writes", async () => {
    const bar = await selectAll(); fireEvent.click(within(bar).getByRole("button", {name: "Система оцінювання…"}));
    const dialog = await screen.findByRole("dialog", {name: "Система оцінювання для 3 завдань"});
    fireEvent.pointerDown(within(dialog).getByRole("button", {name: "Оцінювання підзавдання"}), {button: 0, ctrlKey: false});
    fireEvent.click(screen.getByRole("menuitemradio", {name: "Динамічне"}));
    const max = within(dialog).getByRole("spinbutton", {name: /^Від/}) as HTMLInputElement;
    const min = within(dialog).getByRole("spinbutton", {name: /^До/}) as HTMLInputElement;
    expect(max.max).toBe("999"); expect(min.max).toBe("999");
    fireEvent.change(max, {target: {value: "1001"}}); fireEvent.change(min, {target: {value: "1000"}});
    expect(max.value).toBe("1001"); expect(min.value).toBe("1000");
    expect(within(dialog).getByText("Ціле число від 1 до 999.")).toBeTruthy();
    expect(within(dialog).getByText("Ціле число від 0 до 999.")).toBeTruthy();
    const apply = within(dialog).getByRole("button", {name: "Застосувати"});
    expect(apply).toHaveProperty("disabled", true); fireEvent.click(apply); expect(api.scoring).not.toHaveBeenCalled();
});
