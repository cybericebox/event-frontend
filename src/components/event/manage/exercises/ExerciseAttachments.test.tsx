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

const attachment = {ID: "a1", ExerciseName: "Web", ExerciseID: "x1", VersionNumber: 1, LatestVersionNumber: 2, UpdateAvailable: true, Status: 0, Revision: 0, Resources: null, ChallengeCount: 0, VariantCount: 1} as unknown as EventExerciseAttachment;
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
