// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ScoreboardView} from "./ScoreboardView";
import {apiReadable, audiences, canOpenLive, effectiveLiveAudience, freezeApplied, infoAvailability, liveAudiences, liveButton, phases, visibilities, type Phase} from "./scoreboardMatrix.fixture";

const state = vi.hoisted(() => ({staff: false, event: null as Record<string, unknown> | null, participant: null as Record<string, unknown> | null, getResults: vi.fn()}));

vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => state.event}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => state.participant}));
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
    state.participant = null;
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

const offsets: Record<Phase, [number, number]> = {before: [hour, 5 * hour], during: [-hour, hour], after: [-5 * hour, -hour]};

describe("results page matrix: audience × visibility × phase × freeze × live audience", () => {
    for (const audience of audiences) for (const visibility of visibilities) for (const phase of phases) for (const freezeActive of [false, true]) for (const live of liveAudiences) {
        it(`${audience}, visibility ${visibility}, ${phase}, freeze ${freezeActive ? "active" : "off"}, live ${live}`, async () => {
            const [start, finish] = offsets[phase];
            const availability = infoAvailability(audience, visibility, phase);
            const info = {CanViewResults: availability === "available", ResultsAvailability: availability, CanOpenLive: canOpenLive(visibility, phase, live)};
            const base = {...event(start, "hidden"), FinishTime: new Date(Date.now() + finish).toISOString()};
            state.staff = audience === "staff";
            // Staff and applicants read the guest info; the participant, their own.
            const guestView = infoAvailability(audience === "participant" ? "guest" : audience, visibility, phase);
            state.event = {...base, CanViewResults: guestView === "available", ResultsAvailability: guestView, LiveAudience: effectiveLiveAudience(live, visibility)};
            state.participant = audience === "participant" ? {event: state.event, participantInfo: info, ownTeam: null} : null;
            const applied = freezeApplied(audience, phase, freezeActive);
            state.getResults.mockImplementation(async () => {
                if (!apiReadable(audience, visibility, phase)) throw new Error("the page must not ask for closed results");
                return {Revision: 1, GeneratedAt: new Date().toISOString(), TotalTeams: 1, Timeline: [],
                    Scoreboard: [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", TeamName: "Альфа", Points: 300, Solved: 2, LastSolveAt: null}],
                    Freeze: {Enabled: true, FrozenAt: new Date(Date.now() - 600_000).toISOString(), FinishAt: base.FinishTime, OpenedAt: null, Active: freezeActive && phase === "during", Applied: applied},
                    Display: {ChartEnabled: false, ChartTeams: 10, RowsLimit: null}};
            });
            renderView();
            const staff = audience === "staff";
            const sees = staff || visibility === 2 || (visibility === 1 && audience === "participant");
            expect(screen.getByRole("heading", {name: "Результати"})).toBeTruthy();
            if (!sees) {
                expect(screen.getByText(visibility === 0 ? "Рейтинг приховано організатором" : "Рейтинг доступний лише учасникам")).toBeTruthy();
                expect(state.getResults).not.toHaveBeenCalled();
            } else if (phase === "before") {
                expect(screen.getByText("Рейтинг зʼявиться після початку")).toBeTruthy();
                expect(state.getResults).not.toHaveBeenCalled();
            } else {
                expect(await screen.findByText("Альфа")).toBeTruthy();
                expect(screen.queryByText("Таблиця показує стан на момент заморожування. Підсумки — після фіналу.") !== null).toBe(applied);
                expect(screen.getByText("Наживо")).toBeTruthy();
                expect(screen.getByText(/^Оновлено /)).toBeTruthy();
            }
            expect(screen.queryByRole("link", {name: "Відкрити Live"}) !== null).toBe(liveButton(audience, visibility, phase, live));
        });
    }
});
