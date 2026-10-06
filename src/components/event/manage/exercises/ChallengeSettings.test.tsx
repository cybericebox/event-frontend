// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const server = vi.hoisted(() => ({status: "published", mode: "all_ready", attempts: null as number | null, put: vi.fn(), gate: null as null | (() => void)}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "3f1c2d4e-0000-4000-8000-000000000001", Name: "CTF", Participation: 0, LogoURL: null}, canManage: true})}));
vi.mock("@/api/manage", async original => ({
    ...(await original() as object),
    getManageConfig: async () => ({
        EventID: "3f1c2d4e-0000-4000-8000-000000000001", Participation: 0, Registration: 0, ScoreboardVisibility: 0, ParticipantsVisibility: 0,
        PreviewDescription: "", PreviewPicture: "", MaxTeamSize: 3, MinTeamSize: null, MaxTeams: null, InfrastructureAllowed: true,
        AllowPseudonyms: false, ShowDifficulty: true, HintsDisabled: false, HintChargeMode: "reward", MaxFlagAttempts: server.attempts, TaskRevealMode: server.mode,
    }),
    getManageLifecycle: async () => ({Configured: true, Status: server.status}),
    getManageScoring: async () => ({Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0, StaticPoints: 100, ForceEventScoring: false}),
    putManageConfig: server.put,
}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {toast} from "react-hot-toast";
import {ChallengeSettings} from "./ChallengeSettings";

function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ChallengeSettings /></QueryClientProvider>);
}

describe("Показ завдань", () => {
    afterEach(() => {cleanup(); Object.assign(server, {status: "published", mode: "all_ready", attempts: null}); server.put.mockReset();});

    it("shows the saved mode and switches at once, without waiting for the server", async () => {
        server.put.mockImplementation(() => new Promise(() => undefined));
        renderPage();
        const training = await screen.findByLabelText(/Для кожної команди окремо/) as HTMLInputElement;
        expect((await screen.findByLabelText(/Одночасно для всіх/) as HTMLInputElement).checked).toBe(true);
        fireEvent.click(training);
        const current = screen.getByLabelText(/Для кожної команди окремо/) as HTMLInputElement;
        await waitFor(() => expect((screen.getByLabelText(/Для кожної команди окремо/) as HTMLInputElement).checked).toBe(true));
        expect(current.matches(":disabled")).toBe(false);
        await waitFor(() => expect(server.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({TaskRevealMode: "as_ready"})));
    });

    it("rolls the choice back and shows a toast when the save fails", async () => {
        server.put.mockRejectedValue(new Error("boom"));
        renderPage();
        fireEvent.click(await screen.findByLabelText(/Для кожної команди окремо/));
        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
        await waitFor(() => expect((screen.getByLabelText(/Одночасно для всіх/) as HTMLInputElement).checked).toBe(true));
        expect((screen.getByLabelText(/Для кожної команди окремо/) as HTMLInputElement).checked).toBe(false);
    });

    it("is locked with a hint after the event has started", async () => {
        server.status = "started";
        renderPage();
        expect((await screen.findByLabelText(/Для кожної команди окремо/) as HTMLInputElement).matches(":disabled")).toBe(true);
        expect(screen.getByText("Після початку заходу режим показу змінити не можна.")).toBeTruthy();
    });
});

describe("Спроби", () => {
    afterEach(() => {cleanup(); Object.assign(server, {status: "published", mode: "all_ready", attempts: null}); server.put.mockReset();});
    const field = async () => await screen.findByRole("spinbutton", {name: "Максимум невдалих спроб на завдання"}) as HTMLInputElement;

    it("shows the saved limit and an empty field when unlimited", async () => {
        server.attempts = 4;
        renderPage();
        expect((await field()).value).toBe("4");
    });

    it("saves a typed limit at once without disabling anything, and sends it with the rest of the config", async () => {
        server.put.mockImplementation(() => new Promise(() => undefined));
        renderPage();
        const input = await field();
        expect(input.value).toBe("");
        fireEvent.change(input, {target: {value: "5"}});
        fireEvent.blur(input);
        await waitFor(() => expect(server.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({MaxFlagAttempts: 5, TaskRevealMode: "all_ready"})));
        expect(input.disabled).toBe(false);
        expect((await screen.findByLabelText(/Для кожної команди окремо/) as HTMLInputElement).matches(":disabled")).toBe(false);
        expect((await field()).value).toBe("5");
    });

    it("clears the limit with an empty field and refuses a value out of range", async () => {
        server.attempts = 4;
        server.put.mockImplementation(() => new Promise(() => undefined));
        renderPage();
        const input = await field();
        fireEvent.change(input, {target: {value: "1001"}});
        fireEvent.blur(input);
        expect(server.put).not.toHaveBeenCalled();
        expect(screen.getByText(/від 1 до 1000/)).toBeTruthy();
        fireEvent.change(input, {target: {value: ""}});
        fireEvent.blur(input);
        await waitFor(() => expect(server.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({MaxFlagAttempts: null})));
    });
});
