// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ApiErrorCode} from "@/api/apiErrors";
import type {EventExerciseAttachment} from "@/api/manageChallenges";

const api = vi.hoisted(() => ({update: vi.fn(), fork: vi.fn(), revert: vi.fn(), detach: vi.fn()}));
vi.mock("@/api/manageChallenges", () => ({
    updateEventExercise: api.update, forkEventExercise: api.fork, revertEventExercise: api.revert, detachEventExercise: api.detach,
}));
vi.mock("@/api/manage", async () => ({
    ...(await vi.importActual<typeof import("@/api/manage")>("@/api/manage")),
    getManageConfig: async () => ({HintsDisabled: false, InfrastructureAllowed: true, MaxFlagAttempts: null}),
    getManageLifecycle: async () => ({Status: "not_published"}),
    getManageScoring: async () => ({ForceEventScoring: false}),
}));
vi.mock("@/api/manageLabs", () => ({getManageLabs: async () => ({})}));
vi.mock("@/api/manageStages", () => ({getManageStages: async () => []}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1"}, canManage: true})}));

const attachment = {ID: "a1", ExerciseName: "Web", ExerciseID: "x1", VersionNumber: 1, LatestVersionNumber: 2, UpdateAvailable: true, Status: 0, Revision: 0, Resources: null, ChallengeCount: 0, VariantCount: 1,
    AvgDifficulty: 4.5, TaskCount: 2, TaskNames: ["Pinned one", "Pinned two"]} as unknown as EventExerciseAttachment;
const refreshAll = vi.fn(async () => undefined);
vi.mock("./useBoardSets", () => ({
    useBoardSets: () => ({
        attachments: {data: [attachment]}, sets: {data: [{attachment, challenges: []}]}, pending: false, failed: false, error: null,
        retry: vi.fn(), refreshSets: vi.fn(), refreshGroups: vi.fn(), refreshAll,
    }),
}));
vi.mock("./useBoardMutations", () => ({useBoardMutations: () => ({setPublished: vi.fn(), setHintsEnabled: vi.fn(), setMaxFlagAttempts: vi.fn()})}));
vi.mock("./ResourcePlanSummary", () => ({ResourcePlanSummary: () => null}));
vi.mock("./TaskRow", () => ({TaskRow: () => null, HintMark: () => null}));

import {toast} from "react-hot-toast";
import {ManageApiError} from "@/api/manage";
import {ExerciseAttachments} from "./ExerciseAttachments";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); vi.resetAllMocks();});

const teams = [{ID: "t1", Name: "Red"}, {ID: "t2", Name: ""}];
const running = () => new ManageApiError(409, ApiErrorCode.ExerciseStandsRunning, undefined, {teams});

function setup() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><ExerciseAttachments /></QueryClientProvider>);
}

// The update button of the set's header opens the plain confirmation; confirming it hits the running-stage conflict.
async function openStandsDialog() {
    api.update.mockRejectedValueOnce(running());
    setup();
    fireEvent.click(await screen.findByRole("button", {name: "Оновити до нової версії"}));
    await screen.findByText("Оновити до версії 2?");
    const dialog = document.querySelector("dialog")!;
    fireEvent.click(within(dialog).getByRole("button", {name: "Оновити"}));
    await within(dialog).findByText("Перестворити стенди команд?");
    return dialog;
}

describe("running stage confirmation", () => {
    it("turns a 409 into the stand dialog with the teams, then retries with RecreateStands", async () => {
        const dialog = await openStandsDialog();
        expect(api.update).toHaveBeenCalledWith("e1", "a1", undefined, false);
        expect(dialog.textContent).toContain("Команди: Red, Команда модераторів");
        api.update.mockResolvedValueOnce(attachment);
        fireEvent.click(within(dialog).getByRole("button", {name: "Перестворити стенди"}));
        await waitFor(() => expect(api.update).toHaveBeenLastCalledWith("e1", "a1", undefined, true));
        await waitFor(() => expect(refreshAll).toHaveBeenCalled());
        expect(toast.success).toHaveBeenCalled();
    });

    it("cancels without a retry", async () => {
        const dialog = await openStandsDialog();
        fireEvent.click(within(dialog).getByRole("button", {name: "Скасувати"}));
        await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
        expect(api.update).toHaveBeenCalledTimes(1);
    });
});

describe("flag repeat warning", () => {
    const limitText = "Завдання «Web» має 15 різних флагів, а команд може бути до 40: після 15-ї команди флаги почнуть повторюватися.";
    function withRepeat(repeat: unknown, run: () => Promise<void>) {
        Object.assign(attachment, {FlagsRepeat: repeat});
        return run().finally(() => Object.assign(attachment, {FlagsRepeat: null}));
    }

    it("says how many flags and teams, once, as a warning (not an error) while the set is open", () => withRepeat({Flags: 15, Teams: 40, Reason: "limit"}, async () => {
        setup();
        const text = await screen.findByText(limitText);
        const block = text.closest(".event-exercise-set__warning")!;
        expect(block.className).toContain("event-exercise-set__warning--warn");
        expect(screen.getAllByText(limitText)).toHaveLength(1);
        expect(screen.queryByRole("img", {name: limitText})).toBeNull();
    }));

    it("shrinks to a warning mark with the text in its tooltip when the set is collapsed", () => withRepeat({Flags: 15, Teams: 40, Reason: "limit"}, async () => {
        setup();
        await screen.findByText(limitText);
        fireEvent.click(screen.getByRole("button", {name: /Згорнути/}));
        expect(document.querySelector(".event-exercise-set__warning")).toBeNull();
        expect(screen.getByRole("img", {name: limitText})).toBeTruthy();
    }));

    it("names the teams that exist now when the event has no team limit, and a pool already used up", async () => {
        await withRepeat({Flags: 15, Teams: 16, Reason: "teams"}, async () => {
            setup();
            expect(await screen.findByText("Завдання «Web» має 15 різних флагів, а команд уже 16: флаги повторюватимуться.")).toBeTruthy();
        });
        cleanup();
        await withRepeat({Flags: 15, Teams: 3, Reason: "repeated"}, async () => {
            setup();
            expect(await screen.findByText("Флаги завдання «Web» уже повторюються: усі 15 видано.")).toBeTruthy();
        });
    });

    it("is hidden otherwise", async () => {
        setup();
        await screen.findByRole("heading", {name: "Web"});
        expect(document.querySelector(".event-exercise-set__warning")).toBeNull();
    });
});

describe("the set's pinned stats", () => {
    it("shows the average difficulty and the subtask count; the count opens the names and never toggles the set", async () => {
        setup();
        const set = (await screen.findByRole("heading", {name: "Web"})).closest("article")!;
        expect(within(set).getByLabelText("Складна, 4,5")).toBeTruthy();
        const count = within(set).getByRole("button", {name: "Підзавдання: 2. Показати назви"});
        const panel = document.getElementById(count.getAttribute("popovertarget")!)!;
        expect([...panel.querySelectorAll("li")].map(item => item.textContent)).toEqual(["Pinned one", "Pinned two"]);
        const toggle = set.querySelector(".event-exercise-set__toggle")!;
        const before = toggle.getAttribute("aria-expanded");
        fireEvent.click(count);
        expect(toggle.getAttribute("aria-expanded")).toBe(before);
    });
});
