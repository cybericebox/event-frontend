// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ScoreboardView} from "./ScoreboardView";
import {apiReadable, audiences, freezeApplied, infoAvailability, phases, visibilities, type Phase} from "./scoreboardMatrix.fixture";

const state = vi.hoisted(() => ({staff: false, event: null as Record<string, unknown> | null, participant: null as Record<string, unknown> | null, getResults: vi.fn()}));

vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => state.event}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => state.participant}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: state.staff, pending: false})}));
vi.mock("@/utils/eventStream", () => ({useEventStream: () => "live"}));
vi.mock("./ScoreChart", () => ({ScoreChart: ({teamIDs, note}: {teamIDs: string[]; note?: string}) => <div data-testid="chart-plot" data-lines={teamIDs.length}>{note}</div>}));
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
    state.participant = null;
    state.getResults.mockReset();
    state.getResults.mockResolvedValue({Revision: 1, GeneratedAt: new Date().toISOString(), TotalTeams: 1, Timeline: [],
        Scoreboard: [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", TeamName: "Альфа", Points: 300, Solved: 2, LastSolveAt: null}],
        Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
        Display: {ChartEnabled: false, ChartTeams: 10, RowsLimit: null}});
});
afterEach(cleanup);

function snapshot(points: number, chart: boolean, freeze: Record<string, unknown> = {}, teams = [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", TeamName: "Альфа", Points: points, Solved: points ? 2 : 0, LastSolveAt: null}]) {
    return {Revision: 1, GeneratedAt: new Date().toISOString(), TotalTeams: teams.length, Timeline: [], Scoreboard: teams,
        Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false, ...freeze},
        Display: {ChartEnabled: chart, ChartTeams: 10, RowsLimit: null}};
}

it("lists the teams with no points before the start and keeps the chart axes with a note", async () => {
    state.event = event(hour, "not_started");
    state.getResults.mockResolvedValue(snapshot(0, true));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByRole("columnheader", {name: "Місце"})).toBeTruthy();
    const plot = screen.getByTestId("chart-plot");
    expect(plot.textContent).toBe("Графік зʼявиться після початку");
    expect(plot.getAttribute("data-lines")).toBe("0");
    expect(screen.getByText(/до старту/)).toBeTruthy();
});

it("draws the leaders during the event and respects the chart setting", async () => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValue(snapshot(300, true));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByTestId("chart-plot").getAttribute("data-lines")).toBe("1");
    cleanup();
    state.getResults.mockResolvedValue(snapshot(300, false));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.queryByTestId("score-chart")).toBeNull();
});

it("says there are no teams yet in the table and on the chart", async () => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValue(snapshot(0, true, {}, []));
    renderView();
    expect((await screen.findAllByText("Ще немає допущених команд")).length).toBe(2);
});

it("lets the staff read results shown to participants only, with no Live action on this page", async () => {
    state.event = event(-hour, "participants_only");
    state.staff = true;
    state.getResults.mockResolvedValue(snapshot(300, false));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.queryByRole("link", {name: "Відкрити Live"})).toBeNull();
});

it("explains a closed ranking inside the table block", () => {
    state.event = event(-hour, "participants_only");
    renderView();
    expect(screen.getByText("Рейтинг доступний лише учасникам")).toBeTruthy();
    expect(state.getResults).not.toHaveBeenCalled();
});

const offsets: Record<Phase, [number, number]> = {before: [hour, 5 * hour], during: [-hour, hour], after: [-5 * hour, -hour]};

describe("results page matrix: audience × visibility × phase × freeze × chart", () => {
    for (const audience of audiences) for (const visibility of visibilities) for (const phase of phases) for (const freezeActive of [false, true]) for (const chart of [false, true]) {
        it(`${audience}, visibility ${visibility}, ${phase}, freeze ${freezeActive ? "active" : "off"}, chart ${chart ? "on" : "off"}`, async () => {
            const [start, finish] = offsets[phase];
            const availability = infoAvailability(audience, visibility, phase);
            const base = {...event(start, "hidden"), FinishTime: new Date(Date.now() + finish).toISOString()};
            state.staff = audience === "staff";
            // Staff and applicants read the guest info; the participant, their own.
            const guestView = infoAvailability(audience === "participant" ? "guest" : audience, visibility, phase);
            state.event = {...base, CanViewResults: guestView === "available", ResultsAvailability: guestView};
            state.participant = audience === "participant" ? {event: state.event, participantInfo: {CanViewResults: availability === "available", ResultsAvailability: availability}, ownTeam: null} : null;
            const applied = freezeApplied(audience, phase, freezeActive);
            const sees = apiReadable(audience, visibility);
            state.getResults.mockImplementation(async () => {
                if (!sees) throw new Error("the page must not ask for closed results");
                return snapshot(phase === "before" ? 0 : 300, chart, {Enabled: true, FrozenAt: new Date(Date.now() - 600_000).toISOString(), FinishAt: base.FinishTime, Active: freezeActive && phase === "during", Applied: applied});
            });
            renderView();
            expect(screen.getByRole("heading", {name: "Результати"})).toBeTruthy();
            if (!sees) {
                expect(screen.getByText(visibility === 0 ? "Рейтинг приховано організатором" : "Рейтинг доступний лише учасникам")).toBeTruthy();
                expect(state.getResults).not.toHaveBeenCalled();
                expect(screen.queryByTestId("score-chart")).toBeNull();
            } else {
                // Every phase lists the teams; before the start with 0 points.
                expect(await screen.findByText("Альфа")).toBeTruthy();
                expect(screen.getByText(phase === "before" ? "0" : "300", {selector: "td.event-scoreboard__points"})).toBeTruthy();
                expect(screen.queryByText("Таблиця показує стан на момент заморожування. Підсумки — після фіналу.") !== null).toBe(applied);
                expect(screen.getByText("Наживо")).toBeTruthy();
                expect(screen.getByText(/^Оновлено /)).toBeTruthy();
                const plot = screen.queryByTestId("chart-plot");
                expect(plot !== null).toBe(chart);
                if (plot) expect(plot.textContent).toBe(phase === "before" ? "Графік зʼявиться після початку" : "");
            }
            // Live is a staff screen opened from /manage: never on this page.
            expect(screen.queryByRole("link", {name: "Відкрити Live"})).toBeNull();
        });
    }
});
