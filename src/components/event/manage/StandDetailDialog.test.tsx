// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
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
