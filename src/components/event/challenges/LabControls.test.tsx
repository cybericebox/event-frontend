// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ownBoardSchema, ParticipantChallengeError, type OwnBoard} from "@/api/participantChallenges";
import {completedLab, manualRunningLab, manuallyStoppedLab, runningLab} from "@/test/labLifecycle";
import type {LabLifecycle} from "@/api/labLifecycle";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {labLifecycleKey, rememberLab} from "./labLifecycleCache";
const api = vi.hoisted(() => ({stop: vi.fn(), restart: vi.fn()}));
vi.mock("@/api/participantChallenges", async original => ({...await original<typeof import("@/api/participantChallenges")>(), stopOwnLab: api.stop, restartOwnLab: api.restart}));
import {LabControls} from "./LabControls";
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function () {this.removeAttribute("open");};
});
afterEach(() => {cleanup(); api.stop.mockReset(); api.restart.mockReset();});
function mount(lab: LabLifecycle = manualRunningLab) {
    const client = new QueryClient();
    rememberLab(client, "participant", "e", lab);
    const refresh = vi.fn();
    const board = {...ownBoardSchema.parse({ServerNow: "2026-10-08T12:00:00Z"}), Challenges: [
        {...fixtureChallenge, Lab: lab, SolvedAt: "history", Practice: true, AwardedPoints: 42},
        {...fixtureChallenge, EventChallengeID: "other", Lab: {...runningLab, ID: "00000000-0000-4000-8000-000000000101"}},
    ]};
    client.setQueryData(["event-own-challenges", "e"], board);
    const ui = render(<QueryClientProvider client={client}><LabControls eventID="e" lab={lab} onRefresh={refresh} /></QueryClientProvider>);
    return {client, refresh, board, ...ui};
}
function stop() {
    fireEvent.click(screen.getByRole("button", {name: "Зупинити"}));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", {name: "Зупинити"}));
}
describe("explicit manual Lab controls", () => {
    it("hides legacy policy-dependent stop and strictly false capabilities", () => {
        mount(runningLab);
        expect(screen.queryByRole("button")).toBeNull();
        cleanup(); mount({...manualRunningLab, SnapshotPolicy: null});
        expect(screen.queryByRole("button")).toBeNull();
    });
    it("asks with a danger confirm, cancellation focus and a future filesystem requirement", () => {
        mount(); fireEvent.click(screen.getByRole("button", {name: "Зупинити"}));
        expect(screen.getByText("Зупинити середовище?")).toBeTruthy();
        expect(screen.getByText(/Перед фізичною зупинкою потрібен успішний знімок файлового стану/)).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByRole("button", {name: "Скасувати"}));
        expect(within(screen.getByRole("alertdialog")).getByRole("button", {name: "Зупинити"}).className).toContain("ib-btn--danger-solid");
        fireEvent.keyDown(window, {key: "Escape"});
        expect(api.stop).not.toHaveBeenCalled();
    });
    it("withdraws only the accepted shared Lab and preserves task history/progress until acceptance", async () => {
        let finish!: (value: LabLifecycle) => void;
        api.stop.mockImplementation(() => new Promise<LabLifecycle>(resolve => {finish = resolve;}));
        const {client, board} = mount(); stop();
        await waitFor(() => expect(api.stop).toHaveBeenCalledTimes(1));
        expect(client.getQueryData(labLifecycleKey("participant", "e", manualRunningLab.ID))).toEqual(manualRunningLab);
        await act(async () => {finish(manuallyStoppedLab);});
        const result = client.getQueryData<OwnBoard>(["event-own-challenges", "e"])!;
        expect(result.Challenges[0]).toEqual({...board.Challenges[0], Lab: manuallyStoppedLab});
        expect(result.Challenges[1]).toEqual(board.Challenges[1]);
        expect(api.restart).not.toHaveBeenCalled();
    });
    it("retries an uncertain stop with the same UUID and revision; inline error leaves the confirmation open", async () => {
        api.stop.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(manuallyStoppedLab);
        mount(); stop(); await screen.findByRole("alert");
        const first = api.stop.mock.calls[0];
        fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", {name: "Зупинити"}));
        await waitFor(() => expect(api.stop).toHaveBeenCalledTimes(2));
        expect(api.stop.mock.calls[1]).toEqual(first);
    });
    it("keeps a stopped Lab on a capacity refusal and refreshes that Lab only", async () => {
        api.restart.mockRejectedValue(new ParticipantChallengeError(409));
        const {client, refresh} = mount(manuallyStoppedLab);
        expect(api.restart).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", {name: "Запустити знову"}));
        await screen.findByRole("alert");
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(client.getQueryData(labLifecycleKey("participant", "e", manuallyStoppedLab.ID))).toEqual(manuallyStoppedLab);
    });
    it("restarts only on click, renders preparing from acceptance and never permits solved closure", async () => {
        const preparing = {...manualRunningLab, Revision: "9007199254740995", RuntimeState: "preparing" as const};
        api.restart.mockResolvedValue(preparing);
        const {client, board} = mount(manuallyStoppedLab);
        expect(api.restart).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", {name: "Запустити знову"}));
        await waitFor(() => expect(client.getQueryData(labLifecycleKey("participant", "e", preparing.ID))).toEqual(preparing));
        expect(client.getQueryData<OwnBoard>(["event-own-challenges", "e"])!.Challenges[1]).toEqual(board.Challenges[1]);
        cleanup(); mount({...completedLab, CanRestart: true, SnapshotPolicy: "required"});
        expect(screen.queryByRole("button")).toBeNull();
        expect(api.restart).toHaveBeenCalledTimes(1);
    });
    it("discards an accepted operation after the session cache has been cleared", async () => {
        let finish!: (value: LabLifecycle) => void;
        api.stop.mockImplementation(() => new Promise<LabLifecycle>(resolve => {finish = resolve;}));
        const {client} = mount(); stop();
        await waitFor(() => expect(api.stop).toHaveBeenCalledTimes(1));
        client.clear(); await act(async () => {finish(manuallyStoppedLab);});
        expect(client.getQueryData(labLifecycleKey("participant", "e", manualRunningLab.ID))).toBeUndefined();
    });
});
