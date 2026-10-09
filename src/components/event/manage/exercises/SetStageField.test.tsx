// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider, useQuery} from "@tanstack/react-query";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import type {ManageStage} from "@/api/manageStages";

const api = vi.hoisted(() => ({set: vi.fn(), fetchAll: vi.fn(), toastError: vi.fn(), toastOk: vi.fn()}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {error: api.toastError, success: api.toastOk}}));
vi.mock("@/api/manageStages", async importOriginal => ({...await importOriginal<typeof import("@/api/manageStages")>(), setExerciseStage: (...args: unknown[]) => api.set(...args)}));

vi.mock("@/api/manageChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/manageChallenges")>(), getEventExerciseAttachments: (...args: unknown[]) => api.fetchAll(...args)}));

const {SetStageField} = await import("./SetStageField");
const {ManageApiError} = await import("@/api/manage");

afterEach(() => {cleanup(); api.set.mockReset(); api.fetchAll.mockReset(); api.toastError.mockReset(); api.toastOk.mockReset();});

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stage = (n: number, extra: Partial<ManageStage> = {}): ManageStage => ({
    ID: id(n), Name: `Етап ${n}`, OpensAt: "2026-10-01T10:00:00Z", ClosesAt: "2026-10-01T12:00:00Z", Returnable: false, LabRetentionMinutes: null, State: "upcoming", First: false, Last: false, DeployLeadMinutes: 0, ...extra,
});
const attachment = (extra: Partial<EventExerciseAttachment> = {}) => ({ID: id(100), ExerciseName: "Веб", StageID: null, ...extra}) as EventExerciseAttachment;

function Host({initial, stages, canManage = true}: {initial: EventExerciseAttachment; stages: ManageStage[]; canManage?: boolean}) {
    const query = useQuery({queryKey: ["event-exercise-attachments", "e1"], queryFn: async () => [initial], initialData: [initial], staleTime: Infinity});
    return <SetStageField eventID="e1" attachment={query.data[0]} stages={stages} canManage={canManage} />;
}
function renderField(initial: EventExerciseAttachment, stages: ManageStage[], canManage = true) {
    return render(<QueryClientProvider client={new QueryClient()}><Host initial={initial} stages={stages} canManage={canManage} /></QueryClientProvider>);
}
const trigger = () => screen.getByRole("button", {name: /Етап: Веб/});

describe("the stage of a set", () => {
    it("shows the whole event for a set without a stage and the stage name otherwise", () => {
        renderField(attachment(), [stage(1)]);
        expect(trigger().textContent).toContain("Весь захід");
        cleanup();
        renderField(attachment({StageID: id(1)}), [stage(1)]);
        expect(trigger().textContent).toContain("Етап 1");
    });

    it("is locked once the set's stage has opened: nothing leaves an opened stage", () => {
        renderField(attachment({StageID: id(1)}), [stage(1, {State: "open"})]);
        expect((trigger() as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("Завдання в етапі, що вже почався: прибрати його звідти не можна.")).toBeTruthy();
        // the open stage's note: the labs deploy now
        expect(screen.getByText("Лаби розгорнуться зараз; завдання зʼявляться за правилом показу заходу.")).toBeTruthy();
    });

    it("keeps a set of an upcoming stage free to move", () => {
        renderField(attachment({StageID: id(1)}), [stage(1), stage(2)]);
        expect((trigger() as HTMLButtonElement).disabled).toBe(false);
    });

    it("is read-only for a viewer", () => {
        renderField(attachment(), [stage(1)], false);
        expect((trigger() as HTMLButtonElement).disabled).toBe(true);
    });

    it("refuses nothing on the client: a rejected move rolls back with the server's reason", async () => {
        api.set.mockRejectedValue(new ManageApiError(409, 1148));
        renderField(attachment(), [stage(1)]);
        fireEvent.pointerDown(trigger(), {button: 0, ctrlKey: false});
        const option = await screen.findByRole("menuitemradio", {name: "Етап 1"});
        fireEvent.click(option);
        await waitFor(() => expect(api.set).toHaveBeenCalledWith("e1", id(100), id(1)));
        await waitFor(() => expect(api.toastError).toHaveBeenCalledWith("Етап закрито, його не можна змінювати"));
    });
});

function Two({initial, stages}: {initial: EventExerciseAttachment[]; stages: ManageStage[]}) {
    const query = useQuery({queryKey: ["event-exercise-attachments", "e1"], queryFn: async () => initial, initialData: initial, staleTime: Infinity});
    return <>{query.data.map(item => <SetStageField key={item.ID} eventID="e1" attachment={item} stages={stages} canManage />)}</>;
}
const renderTwo = (initial: EventExerciseAttachment[], stages: ManageStage[]) => render(<QueryClientProvider client={new QueryClient()}><Two initial={initial} stages={stages} /></QueryClientProvider>);
const triggerOf = (name: string) => screen.getByRole("button", {name: new RegExp(`Етап: ${name}`)});
async function pick(name: string, option: string) {
    fireEvent.pointerDown(triggerOf(name), {button: 0, ctrlKey: false});
    fireEvent.click(await screen.findByRole("menuitemradio", {name: option}));
    await waitFor(() => expect(screen.queryByRole("menuitemradio")).toBeNull());
}
const answer = (setID: string, stageID: string | null) => attachment({ID: setID, ExerciseName: setID === id(100) ? "Веб" : "Мережа", StageID: stageID});
const two = () => [attachment({ID: id(100), ExerciseName: "Веб"}), attachment({ID: id(101), ExerciseName: "Мережа"})];

describe("several sets", () => {
    it("keeps both selectors right when set A and then set B change", async () => {
        api.set.mockImplementation(async (_event: string, setID: string, stageID: string | null) => answer(setID, stageID));
        renderTwo(two(), [stage(1), stage(2)]);
        await pick("Веб", "Етап 1");
        await pick("Мережа", "Етап 2");
        await waitFor(() => expect(api.set).toHaveBeenCalledTimes(2));
        expect(triggerOf("Веб").textContent).toContain("Етап 1");
        expect(triggerOf("Мережа").textContent).toContain("Етап 2");
    });

    it("saves the sets one after another, never in parallel", async () => {
        let release: () => void = () => undefined;
        api.set.mockImplementationOnce(() => new Promise(resolve => {release = () => resolve(answer(id(100), id(1)));}));
        api.set.mockImplementation(async (_event: string, setID: string, stageID: string | null) => answer(setID, stageID));
        renderTwo(two(), [stage(1), stage(2)]);
        await pick("Веб", "Етап 1");
        await pick("Мережа", "Етап 2");
        expect(api.set).toHaveBeenCalledTimes(1);
        // the selectors stay enabled and show the choices while the first save is pending
        expect((triggerOf("Мережа") as HTMLButtonElement).disabled).toBe(false);
        expect(triggerOf("Мережа").textContent).toContain("Етап 2");
        release();
        await waitFor(() => expect(api.set).toHaveBeenCalledTimes(2));
    });

    it("takes the server's answer when it changed the set", async () => {
        api.set.mockImplementation(async (_event: string, setID: string) => answer(setID, id(2)));
        renderTwo(two(), [stage(1), stage(2)]);
        await pick("Веб", "Етап 1");
        await waitFor(() => expect(triggerOf("Веб").textContent).toContain("Етап 2"));
        expect(triggerOf("Мережа").textContent).toContain("Весь захід");
    });

    it("rolls back only the failed set, with a toast", async () => {
        api.set.mockImplementation(async (_event: string, setID: string, stageID: string | null) => {
            if (setID === id(100)) throw new ManageApiError(409, 1148);
            return answer(setID, stageID);
        });
        api.fetchAll.mockResolvedValue(two());
        renderTwo(two(), [stage(1), stage(2)]);
        await pick("Веб", "Етап 1");
        await pick("Мережа", "Етап 2");
        await waitFor(() => expect(api.toastError).toHaveBeenCalledWith("Етап закрито, його не можна змінювати"));
        await waitFor(() => expect(triggerOf("Веб").textContent).toContain("Весь захід"));
        expect(triggerOf("Мережа").textContent).toContain("Етап 2");
    });
});

// The board hands out copies of the sets taken when it loaded: they never follow the attachments cache.
function Stale({board, stages}: {board: EventExerciseAttachment[]; stages: ManageStage[]}) {
    useQuery({queryKey: ["event-exercise-attachments", "e1"], queryFn: async () => board, initialData: board, staleTime: Infinity});
    return <>{board.map(item => <SetStageField key={item.ID} eventID="e1" attachment={item} stages={stages} canManage />)}</>;
}

describe("a set copied from the board", () => {
    it("shows the stage chosen on it after a change of a sibling set, whatever else is toggled", async () => {
        api.set.mockImplementation(async (_event: string, setID: string, stageID: string | null) => answer(setID, stageID));
        render(<QueryClientProvider client={new QueryClient()}><Stale board={two()} stages={[stage(1), stage(2)]} /></QueryClientProvider>);
        await pick("Веб", "Етап 1");
        await pick("Мережа", "Етап 2");
        await waitFor(() => expect(api.set).toHaveBeenCalledTimes(2));
        expect(triggerOf("Веб").textContent).toContain("Етап 1");
        expect(triggerOf("Мережа").textContent).toContain("Етап 2");
    });
});
