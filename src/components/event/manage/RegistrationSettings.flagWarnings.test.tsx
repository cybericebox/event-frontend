// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, renderHook, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";

const api = vi.hoisted(() => ({config: vi.fn(), attachments: vi.fn()}));
const base = {EventID: "e1", Participation: 1, Registration: 1, ScoreboardVisibility: 2, ParticipantsVisibility: 1, PreviewDescription: "", PreviewPicture: "",
    MaxTeamSize: 4, MinTeamSize: null, MaxTeams: null as number | null, InfrastructureAllowed: true, AllowPseudonyms: false, ShowDifficulty: true, HintsDisabled: false,
    HintChargeMode: "reward", MaxFlagAttempts: null, TaskRevealMode: "all_ready", Theme: {Brand: "#211A52", Accent: "", Version: 1}, UpdatedAt: ""};
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Name: "Event", LogoURL: null}, canManage: true})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("next/link", () => ({default: ({children}: {children: ReactNode}) => <a>{children}</a>}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
vi.mock("@/api/manage", async original => ({...await original() as object,
    getManageConfig: async () => base,
    getManageLifecycle: async () => ({Configured: true, Status: "published", JoinPolicy: 1, PublishAt: "2026-10-01T10:00:00Z", StartAt: "2026-10-20T10:00:00Z", FinishAt: null, WithdrawAt: null}),
    putManageConfig: (...args: unknown[]) => api.config(...args),
}));
vi.mock("@/api/manageChallenges", async original => ({...await original() as object,
    getEventExerciseAttachments: (...args: unknown[]) => api.attachments(...args),
    getEventChallengeGroups: async () => [], getEventBoardChallenges: async () => [],
}));

const {RegistrationSettings} = await import("./RegistrationSettings");
const {useBoardSets} = await import("./exercises/useBoardSets");
afterEach(() => {cleanup(); vi.resetAllMocks();});

const set = (flagsRepeat: unknown) => [{ID: "00000000-0000-4000-8000-000000000001", ExerciseName: "Маршрут", ExerciseID: "x", ExerciseVersionID: "00000000-0000-4000-8000-000000000002",
    VersionNumber: 1, Status: 0, Revision: 0, FlagsRepeat: flagsRepeat}];

it("refreshes the task list's flag warnings after the team limit changes: no reload needed", async () => {
    // The app keeps reads fresh for a minute; the task list was already read without a warning.
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: 60_000}}});
    const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    api.attachments.mockResolvedValueOnce(set(null));
    const first = renderHook(() => useBoardSets("e1"), {wrapper});
    await waitFor(() => expect(first.result.current.attachments.data?.[0].FlagsRepeat).toBeNull());
    first.unmount();

    api.config.mockImplementation(async (_: string, input: typeof base) => ({...base, ...input}));
    render(<RegistrationSettings />, {wrapper});
    const limit = await waitFor(() => {const input = document.getElementById("max-teams"); if (!input) throw new Error("no field"); return input as HTMLInputElement;});
    fireEvent.change(limit, {target: {value: "20"}});
    await act(async () => {fireEvent.submit(limit.closest("form")!);});
    await waitFor(() => expect(api.config).toHaveBeenCalled());
    cleanup();

    // Back on «Завдання»: the list is read again and the warning shows.
    api.attachments.mockResolvedValue(set({Flags: 15, Teams: 20, Reason: "limit"}));
    const again = renderHook(() => useBoardSets("e1"), {wrapper});
    await waitFor(() => expect(again.result.current.attachments.data?.[0].FlagsRepeat).toMatchObject({Teams: 20}));
});

it("keeps the task list when only another registration setting changes", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: 60_000}}});
    const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    api.attachments.mockResolvedValue(set(null));
    const first = renderHook(() => useBoardSets("e1"), {wrapper});
    await waitFor(() => expect(first.result.current.attachments.isSuccess).toBe(true));
    first.unmount();
    api.config.mockImplementation(async (_: string, input: typeof base) => ({...base, ...input}));
    render(<RegistrationSettings />, {wrapper});
    fireEvent.click(await screen.findByRole("switch", {name: /псевдонім/i}));
    await act(async () => {fireEvent.submit(document.querySelector("form")!);});
    await waitFor(() => expect(api.config).toHaveBeenCalled());
    expect(client.getQueryState(["event-exercise-attachments", "e1"])?.isInvalidated).toBe(false);
});
