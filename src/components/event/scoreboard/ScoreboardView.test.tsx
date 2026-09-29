// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ScoreboardView} from "./ScoreboardView";

const state = vi.hoisted(() => ({staff: false, event: null as Record<string, unknown> | null, getResults: vi.fn()}));

vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => state.event}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => null}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: state.staff, pending: false})}));
vi.mock("@/utils/eventStream", () => ({useEventStream: () => "live"}));
vi.mock("./ScoreChart", () => ({ScoreChart: () => null}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<object>(), getManageResults: state.getResults}));

const hour = 3_600_000;
function event(startOffset: number, availability: string) {
    return {EventID: "event-1", Name: "Захід", Tag: "event", Participation: 1, StartTime: new Date(Date.now() + startOffset).toISOString(), FinishTime: new Date(Date.now() + 5 * hour).toISOString(),
        CanViewResults: availability === "available", ResultsAvailability: availability};
}

function renderView() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ScoreboardView /></QueryClientProvider>);
}

beforeEach(() => {
    state.staff = false;
    state.getResults.mockReset();
    state.getResults.mockResolvedValue({Revision: 1, GeneratedAt: new Date().toISOString(), TotalTeams: 1, Timeline: [],
        Scoreboard: [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", TeamName: "Альфа", Points: 300, Solved: 2, LastSolveAt: null}],
        Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
        Display: {ChartEnabled: false, ChartTeams: 10, RowsLimit: null}});
});
afterEach(cleanup);

it("shows the page before the start with the empty state inside the table", () => {
    state.event = event(hour, "not_started");
    renderView();
    expect(screen.getByRole("heading", {name: "Результати"})).toBeTruthy();
    expect(screen.getByRole("columnheader", {name: "Місце"})).toBeTruthy();
    expect(screen.getByText("Рейтинг зʼявиться після початку")).toBeTruthy();
    expect(state.getResults).not.toHaveBeenCalled();
});

it("lets the staff read results shown to participants only, with the Live action", async () => {
    state.event = event(-hour, "participants_only");
    state.staff = true;
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByRole("link", {name: "Відкрити Live"}).getAttribute("target")).toBe("_blank");
});

it("explains a closed ranking inside the table block and hides Live from guests", () => {
    state.event = event(-hour, "participants_only");
    renderView();
    expect(screen.getByText("Рейтинг доступний лише учасникам")).toBeTruthy();
    expect(screen.queryByRole("link", {name: "Відкрити Live"})).toBeNull();
    expect(state.getResults).not.toHaveBeenCalled();
});
