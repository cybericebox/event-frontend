// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("@/api/manageLabs", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/manageLabs")>(),
    getStandDetail: vi.fn(), resetStandDevice: vi.fn(), setStandDeviceRescue: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {getStandDetail, resetStandDevice, setStandDeviceRescue, StandDetailSchema} from "@/api/manageLabs";
import {StandDetailDialog} from "./StandDetailDialog";

const teamID = "01900000-0000-7000-8000-000000000022";
const challengeID = "01900000-0000-7000-8000-0000000000c2";
const detail = StandDetailSchema.parse({
    TeamID: teamID, TeamName: "Blue", Moderators: false, Status: "creating", Reason: "", Generation: 0, LaboratoriesAvailable: true,
    Labs: [{
        ChallengeID: challengeID, ChallengeName: "Web", Status: "pending", Reason: "", LiveUnavailable: false,
        Live: {
            Phase: "Queued", Ready: false, Queue: {Position: 1, Length: 3, Reason: "PreparingImages", Message: "", Pods: 2, Pending: 2}, ImageWarning: "", GroupImageWarning: "",
            Devices: [
                {Name: "db", Ready: true, Reason: "", Scheduling: null, Snapshot: {LastSnapshotAt: new Date(Date.now() - 300_000).toISOString(), RestoredAt: null, SizeBytes: 0, Warning: "", Rescue: false}},
                {Name: "web", Ready: false, Reason: "", Scheduling: {State: "Failed", QueuedAt: null, DispatchedAt: null, StartedAt: null, Failure: {Reason: "ImagePull", Message: "pull denied", RestartCount: 2, At: null}}, Snapshot: null},
            ],
        },
    }],
});

function mount(canManage = true) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><StandDetailDialog eventID="e1" teamID={teamID} canManage={canManage} onClose={() => undefined} /></QueryClientProvider>);
}

beforeEach(() => {
    // jsdom has no modal <dialog>.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {this.removeAttribute("open");};
    vi.resetAllMocks(); vi.mocked(getStandDetail).mockResolvedValue(detail);});

afterEach(cleanup);

describe("StandDetailDialog", () => {
    it("shows the queue, a failed device and the saved state", async () => {
        mount();
        expect(await screen.findByText(/Лабораторія в черзі: 1 із 3/)).toBeTruthy();
        expect(screen.getByRole("alert").textContent).toContain("не вдалося завантажити образ");
        expect(screen.getByText(/pull denied/)).toBeTruthy();
        expect(screen.getByText(/Збережено 5 хвилин тому/)).toBeTruthy();
    });

    it("hides device actions without the manage permission", async () => {
        mount(false);
        await screen.findByText("db");
        expect(screen.queryByRole("button", {name: "Скинути пристрій"})).toBeNull();
        expect(screen.queryByRole("switch")).toBeNull();
    });

    it("asks before resetting a device", async () => {
        vi.mocked(resetStandDevice).mockResolvedValue(undefined);
        mount();
        fireEvent.click(await screen.findByRole("button", {name: "Скинути пристрій"}));
        expect(resetStandDevice).not.toHaveBeenCalled();
        const confirm = (await screen.findAllByRole("button", {name: "Скинути пристрій"})).at(-1)!;
        fireEvent.click(confirm);
        await waitFor(() => expect(resetStandDevice).toHaveBeenCalledWith("e1", teamID, challengeID, "db"));
    });

    it("flips the rescue switch before the server answers and keeps it enabled", async () => {
        vi.mocked(setStandDeviceRescue).mockImplementation(() => new Promise(() => undefined));
        mount();
        const toggle = await screen.findByRole("switch");
        fireEvent.click(toggle);
        expect((toggle as HTMLInputElement).checked).toBe(true);
        expect((toggle as HTMLInputElement).disabled).toBe(false);
        await waitFor(() => expect(setStandDeviceRescue).toHaveBeenCalledWith("e1", teamID, challengeID, "db", true));
    });
});

// A single producer row represents the physical environment shared by both objectives.
import type {ManagedLabView} from "@/api/labObservations";
import {managedLab} from "@/test/labObservations";
function canonicalDetail(lab: ManagedLabView = managedLab) {
    return StandDetailSchema.parse({...detail, Labs: [{...detail.Labs[0], Lab: lab, Questions: [{EventChallengeID: challengeID, Name: "First objective"}, {EventChallengeID: managedLab.ID, Name: "Second objective"}]}]});
}
it("shows both Questions and one physical Live block after snapshot failure, with held compute", async () => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail());
    mount();
    await screen.findByText("First objective"); expect(screen.getByText("Second objective")).toBeTruthy();
    expect(document.querySelectorAll(".event-stands__devices")).toHaveLength(1);
    expect(screen.getByText("capture failed")).toBeTruthy();
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("500 мілі-ядер");
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("button", {name: "Скинути пристрій"})).toBeNull();
});
it("does not claim current/released resources from a stale revision even with a stop timestamp", async () => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, ObservedRevision: "6", ActualState: "Stopped", ActualStoppedAt: "2026-10-08T10:00:00Z", Resources: {...managedLab.Resources, RuntimeState: "Released", ReleasedAt: "2026-10-08T10:00:00Z", ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}}}));
    mount(); await screen.findByText("First objective");
    expect(screen.getByText("Спостереження").parentElement?.textContent).toContain("Невідомо");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо");
});
it("prevents an already-open reset confirmation from acting after closure", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, ClosedAt: null, DesiredState: "Running", ActualState: "Running"}));
    render(<QueryClientProvider client={client}><StandDetailDialog eventID="e1" teamID={teamID} canManage onClose={() => undefined} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", {name: "Скинути пристрій"}));
    const confirm = screen.getAllByRole("button", {name: "Скинути пристрій"}).at(-1)!;
    await act(async () => {client.setQueryData(["event-management-stand-detail", "e1", teamID], canonicalDetail());});
    await waitFor(() => expect(screen.queryByRole("switch")).toBeNull());
    fireEvent.click(confirm);
    expect(resetStandDevice).not.toHaveBeenCalled();
});

it.each([
    {AgentUID: ""}, {ObservedAt: null}, {ObservedAt: "invalid"},
])("does not treat missing identity/time as current: %j", async patch => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, ...patch}));
    mount(); await screen.findByText("First objective");
    expect(screen.getByText("Спостереження").parentElement?.textContent).toContain("Невідомо");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо");
});
it("changes release facts only with the matching stop and allocation observation", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail());
    render(<QueryClientProvider client={client}><StandDetailDialog eventID="e1" teamID={teamID} canManage onClose={() => undefined} /></QueryClientProvider>);
    await screen.findByText("First objective");
    const stopped = {...managedLab, Revision: "8", ObservedRevision: "8", ActualState: "Stopped" as const, SnapshotState: "Succeeded" as const, ActualStoppedAt: "2026-10-08T10:01:00Z", ObservedAt: "2026-10-08T10:02:00Z", FailureCode: "", FailureMessage: "", Resources: {...managedLab.Resources, RuntimeState: "Released" as const, ObservedAt: "2026-10-08T10:02:00Z", ReleasedAt: "2026-10-08T10:01:00Z", AllocatedRequests: {CPUMillicores: "0", MemoryBytes: "0"}, ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}}};
    await act(async () => {client.setQueryData(["event-management-stand-detail", "e1", teamID], canonicalDetail({...stopped, ObservedRevision: "7"}));});
    await waitFor(() => expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо"));
    await act(async () => {client.setQueryData(["event-management-stand-detail", "e1", teamID], canonicalDetail(stopped));});
    await waitFor(() => expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("500 мілі-ядер"));
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("0 vCPU");
});
it("never claims release for a current failed stop carrying contradictory released resources", async () => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, Resources: {...managedLab.Resources, RuntimeState: "Released", ReleasedAt: managedLab.ObservedAt, AllocatedRequests: {CPUMillicores: "0", MemoryBytes: "0"}, ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}}}));
    mount(); await screen.findByText("First objective");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо");
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("Невідомо");
});
it("fences queued rescue work when the Lab revision changes before its turn", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    let resolve!: () => void;
    vi.mocked(setStandDeviceRescue).mockImplementation(() => new Promise<void>(done => {resolve = done;}));
    const running = {...managedLab, ClosedAt: null, DesiredState: "Running" as const, ActualState: "Running" as const};
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail(running));
    render(<QueryClientProvider client={client}><StandDetailDialog eventID="e1" teamID={teamID} canManage onClose={() => undefined} /></QueryClientProvider>);
    const toggle = await screen.findByRole("switch");
    fireEvent.click(toggle);
    await waitFor(() => expect(setStandDeviceRescue).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    await act(async () => {client.setQueryData(["event-management-stand-detail", "e1", teamID], canonicalDetail({...running, Revision: "8"}));});
    await waitFor(() => expect(screen.getByText("Спостереження").parentElement?.textContent).toContain("Невідомо"));
    await act(async () => resolve());
    expect(setStandDeviceRescue).toHaveBeenCalledTimes(1);
});

it("cancels queued rescue when its physical Lab row is replaced", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    let resolve!: () => void;
    vi.mocked(setStandDeviceRescue).mockImplementation(() => new Promise<void>(done => {resolve = done;}));
    const running = {...managedLab, ClosedAt: null, DesiredState: "Running" as const, ActualState: "Running" as const};
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail(running));
    render(<QueryClientProvider client={client}><StandDetailDialog eventID="e1" teamID={teamID} canManage onClose={() => undefined} /></QueryClientProvider>);
    const toggle = await screen.findByRole("switch"); fireEvent.click(toggle);
    await waitFor(() => expect(setStandDeviceRescue).toHaveBeenCalledTimes(1)); fireEvent.click(toggle);
    await act(async () => {client.setQueryData(["event-management-stand-detail", "e1", teamID], canonicalDetail({...running, ID: "01900000-0000-7000-8000-000000000099", ExerciseName: "Replacement"}));});
    await waitFor(() => expect(document.querySelector('[data-lab-id="01900000-0000-7000-8000-000000000099"]')).toBeTruthy());
    await act(async () => resolve()); expect(setStandDeviceRescue).toHaveBeenCalledTimes(1);
});
it("withdraws a reset confirmation on a newer running revision", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const running = {...managedLab, ClosedAt: null, DesiredState: "Running" as const, ActualState: "Running" as const};
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail(running));
    render(<QueryClientProvider client={client}><StandDetailDialog eventID="e1" teamID={teamID} canManage onClose={() => undefined} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", {name: "Скинути пристрій"}));
    expect(screen.getAllByRole("button", {name: "Скинути пристрій"})).toHaveLength(2);
    await act(async () => {client.setQueryData(["event-management-stand-detail", "e1", teamID], canonicalDetail({...running, Revision: "8"}));});
    await waitFor(() => expect(screen.getAllByRole("button", {name: "Скинути пристрій"})).toHaveLength(1));
    expect(resetStandDevice).not.toHaveBeenCalled();
});

it("retains held and Live DOM but withdraws current observation claims after a failed refresh", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail());
    render(<QueryClientProvider client={client}><StandDetailDialog eventID="e1" teamID={teamID} canManage onClose={() => undefined} /></QueryClientProvider>);
    await screen.findByText("First objective");
    const live = document.querySelector(".event-stands__devices");
    vi.mocked(getStandDetail).mockRejectedValue(new Error("offline"));
    await act(async () => {await client.refetchQueries({queryKey: ["event-management-stand-detail", "e1", teamID]});});
    await waitFor(() => expect(screen.getByText("Спостереження").parentElement?.textContent).toContain("Невідомо"));
    expect(document.querySelector(".event-stands__devices")).toBe(live);
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("500 мілі-ядер");
});

it("does not credit positive released requests during StopFailed even when runtime says Allocated", async () => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, Resources: {...managedLab.Resources, ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}}}));
    mount(); await screen.findByText("First objective");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо");
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("500 мілі-ядер");
});

it.each([
    ["physical release precedes aggregate stopped", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z"],
    ["independent aggregate observation", "2026-10-08T10:01:00Z", "2026-10-08T10:03:00Z", "2026-10-08T10:02:00Z"],
    ["later aggregate stopped declaration", "2026-10-08T10:03:00Z", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z"],
    ["original control", "2026-10-08T10:01:00Z", "2026-10-08T10:02:00Z", "2026-10-08T10:02:00Z"],
])("renders producer-certified release: %s", async (_name, ActualStoppedAt, ObservedAt, allocationObservedAt) => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, Revision: "8", ObservedRevision: "8", ActualState: "Stopped", SnapshotState: "Succeeded", ActualStoppedAt, ObservedAt,
        Resources: {...managedLab.Resources, RuntimeState: "Released", ReleasedAt: "2026-10-08T10:01:00Z", ObservedAt: allocationObservedAt, AllocatedRequests: {CPUMillicores: "0", MemoryBytes: "0"}, ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "2048"}}));
    mount(); await screen.findByText("First objective");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("500 мілі-ядер");
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("0 vCPU");
    expect(screen.getByText("Фізичне сховище").parentElement?.textContent).toContain("2 КіБ");
    expect(screen.getByText("Звільнення підтверджено")).toBeTruthy();
});

it("shows confirmed release and unknown aggregate stop time independently", async () => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, Revision: "8", ObservedRevision: "8", ActualState: "Stopped", SnapshotState: "Succeeded", ActualStoppedAt: null,
        Resources: {...managedLab.Resources, RuntimeState: "Released", ReleasedAt: "2026-10-08T10:01:00Z", AllocatedRequests: {CPUMillicores: "0", MemoryBytes: "0"}, ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}}}));
    mount(); await screen.findByText("First objective");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("500 мілі-ядер");
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("0 vCPU");
    expect(screen.getByText("Час зупинки").parentElement?.textContent).toContain("Невідомо");
    expect(screen.getByText("Звільнення підтверджено")).toBeTruthy();
});
it.each([{AgentUID: ""}, {ObservedRevision: "7"}, {ActualState: "StopFailed"}] satisfies Partial<ManagedLabView>[])('shows no release on bad identity or failed stop even with nullable time: %j', async patch => {
    vi.mocked(getStandDetail).mockResolvedValue(canonicalDetail({...managedLab, Revision: "8", ObservedRevision: "8", ActualState: "Stopped", SnapshotState: "Succeeded", ActualStoppedAt: null, ...patch,
        Resources: {...managedLab.Resources, RuntimeState: "Released", ReleasedAt: "2026-10-08T10:01:00Z", ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}}}));
    mount(); await screen.findByText("First objective");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо");
    expect(screen.queryByText("Звільнення підтверджено")).toBeNull();
});
