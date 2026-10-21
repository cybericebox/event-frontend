// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {focusManager, QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ScoreboardView} from "./ScoreboardView";
import {ResultsUnavailableError, type ManageResultsSnapshot} from "@/api/manageResults";
import {ManageApiError} from "@/api/manage";
import {apiReadable, audiences, freezeApplied, infoAvailability, phases, visibilities, type Phase} from "./scoreboardMatrix.fixture";

const state = vi.hoisted(() => ({preview: false, previewStartedAt: undefined as string | undefined, previewBoard: vi.fn(), staff: false, event: null as Record<string, unknown> | null, participant: null as Record<string, unknown> | null, getResults: vi.fn(), getChanges: vi.fn()}));
vi.mock("@/components/event/ParticipantPreview", async importOriginal => ({...await importOriginal<typeof import("@/components/event/ParticipantPreview")>(), useParticipantPreview: () => ({active: state.preview, state: {userID: "preview-user", status: 2, startedAt: state.previewStartedAt, team: {ID: "preview-team", Name: "Own preview team"}}, config: {ScoreboardVisibility: 2}})}));
vi.mock("@/api/participantPreview", async importOriginal => ({...await importOriginal<typeof import("@/api/participantPreview")>(), getPreviewBoard: state.previewBoard}));

vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => state.event}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => state.participant}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: state.staff, pending: false})}));
vi.mock("./ScoreChart", () => ({ScoreChart: ({teamIDs, note, startTime, finishTime}: {teamIDs: string[]; note?: string; startTime: Date; finishTime: Date}) => <div data-testid="chart-plot" data-lines={teamIDs.length} data-start={startTime.toISOString()} data-finish={finishTime.toISOString()}>{note}</div>}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<object>(), getManageResults: state.getResults, getResultsChanges: state.getChanges}));

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
    state.preview = false;
    state.previewStartedAt = undefined;
    state.previewBoard.mockReset();
    state.staff = false;
    state.participant = null;
    state.getResults.mockReset();
    state.getChanges.mockReset();
    state.getChanges.mockResolvedValue({Revision: 1, Changes: [], SnapshotRequired: false, FreezeKey: ""});
    state.getResults.mockResolvedValue({Revision: 1, TotalTeams: 1, Timeline: [],
        Scoreboard: [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", TeamName: "Альфа", Points: 300, Solved: 2}],
        Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
        Display: {ChartEnabled: false, ChartTeams: 10, RowsLimit: null}});
});
afterEach(() => {cleanup(); focusManager.setFocused(undefined);});

it("uses only the caller's preview progress for results, chart and polls", async () => {
    state.preview = true;
    state.event = event(-hour, "available");
    state.previewBoard.mockResolvedValue({Challenges: []});
    renderView();
    expect(await screen.findByText("Own preview team")).toBeTruthy();
    expect(state.previewBoard).toHaveBeenCalledWith("event-1");
    expect(state.getResults).not.toHaveBeenCalled();
    expect(state.getChanges).not.toHaveBeenCalled();
    expect(screen.getByTestId("chart-plot").getAttribute("data-lines")).toBe("1");
});

it("starts the preview graph at the saved testing start, before the first solve", async () => {
    state.preview = true;
    state.previewStartedAt = new Date(Date.now() - 2 * hour).toISOString();
    state.event = event(hour, "not_started");
    state.previewBoard.mockResolvedValue({Challenges: []});
    renderView();
    await screen.findByText("Own preview team");
    expect(screen.getByTestId("chart-plot").getAttribute("data-start")).toBe(state.previewStartedAt);
});

it("keeps charting testing after the real event has finished", async () => {
    state.preview = true;
    state.previewStartedAt = new Date(Date.now() - hour).toISOString();
    state.event = {...event(-4 * hour, "available"), FinishTime: new Date(Date.now() - 2 * hour).toISOString()};
    state.previewBoard.mockResolvedValue({Challenges: []});
    const before = Date.now();
    renderView();
    await screen.findByText("Own preview team");
    const end = Date.parse(screen.getByTestId("chart-plot").getAttribute("data-finish")!);
    expect(end).toBeGreaterThanOrEqual(before);
    expect(end).toBeLessThanOrEqual(Date.now());
});

function snapshot(points: number, chart: boolean, freeze: Record<string, unknown> = {}, teams: ManageResultsSnapshot["Scoreboard"] = [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", TeamName: "Альфа", Points: points, Solved: points ? 2 : 0}]) {
    return {Revision: 1, TotalTeams: teams.length, Timeline: [], Scoreboard: teams,
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
    expect(screen.getByText("1 команда")).toBeTruthy();
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

it("shows ranking, name, points and solved count without a last-solve timestamp", async () => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValue(snapshot(300, false, {}, [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", TeamName: "Альфа", Points: 300, Solved: 2}]));
    const {container} = renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Місце", "Команда", "Бали", "Розвʼязано"]);
    expect(container.querySelector("table time")).toBeNull();
});

it("clears a search with its own control and returns focus to the field", async () => {
    state.event = event(-hour, "available");
    renderView();
    await screen.findByText("Альфа");
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(input, {target: {value: "zzz"}});
    expect(screen.queryByText("Альфа")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name: "Очистити пошук"}));
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.getByText("Альфа")).toBeTruthy();
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
    expect(screen.queryByRole("link", {name: "Відкрити результати наживо"})).toBeNull();
});

it("freezes the chart range and own aggregate results without promising live points", async () => {
    state.event = event(-hour, "available");
    state.participant = {event: state.event, participantInfo: {ResultsAvailability: "available", CanViewResults: true}, ownTeam: {ID: "00000000-0000-4000-8000-000000000001"}};
    const frozenAt = new Date(Date.now() - 600_000).toISOString();
    state.getResults.mockResolvedValue(snapshot(300, true, {Enabled: true, FrozenAt: frozenAt, Active: true, Applied: true}));
    renderView();
    await screen.findByText("Альфа");
    expect(screen.getByTestId("chart-plot").getAttribute("data-finish")).toBe(frozenAt);
    expect(screen.queryByText(/Бали вашої команди оновлюються/)).toBeNull();
    expect(document.querySelector(".ib-page-header__sub")?.textContent).toBe("1 команда");
});

it("polls without a stream and explains «Автооновлення»", async () => {
    const opened = vi.fn();
    vi.stubGlobal("EventSource", class {constructor() {opened();}});
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValue(snapshot(300, false, {Enabled: true, FrozenAt: "2026-09-29T15:30:00Z", Active: true, Applied: true}));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByText("Автооновлення")).toBeTruthy();
    expect(opened).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toContain("Сторінка сама перевіряє нові результати приблизно кожні 30 с.");
    expect(document.body.innerHTML).not.toMatch(/Рейтинг заморожено о \d\d:\d\d\./);
    vi.unstubAllGlobals();
});

it("polls the changes after its snapshot and reloads only for visible changes", async () => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValue({...snapshot(300, false), Revision: 4});
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    const poll = async () => {
        await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
    };
    // Nothing new: the cursor stays, no snapshot reload.
    state.getChanges.mockResolvedValueOnce({Revision: 4, Changes: [], SnapshotRequired: false, FreezeKey: ""});
    await poll();
    await waitFor(() => expect(state.getChanges).toHaveBeenLastCalledWith("event-1", 4, null));
    expect(state.getResults).toHaveBeenCalledTimes(1);
    // Other teams' solves hidden by a freeze move the cursor only.
    state.getChanges.mockResolvedValueOnce({Revision: 6, Changes: [], SnapshotRequired: false, FreezeKey: "f"});
    await poll();
    await waitFor(() => expect(state.getChanges).toHaveBeenLastCalledWith("event-1", 4, ""));
    state.getChanges.mockResolvedValueOnce({Revision: 7, Changes: [{Revision: 7, Kind: "team_challenge_solved"}], SnapshotRequired: false, FreezeKey: "f"});
    await poll();
    await waitFor(() => expect(state.getChanges).toHaveBeenLastCalledWith("event-1", 6, "f"));
    // A visible change reloads the snapshot; its revision is the next cursor.
    await waitFor(() => expect(state.getResults).toHaveBeenCalledTimes(2));
    state.getResults.mockResolvedValue({...snapshot(400, false), Revision: 7});
    state.getChanges.mockResolvedValueOnce({Revision: 7, Changes: [], SnapshotRequired: true, FreezeKey: ""});
    await poll();
    await waitFor(() => expect(state.getResults).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("400")).toBeTruthy();
    focusManager.setFocused(undefined);
});

it.each([401, 403, 404])("clears cached results immediately after a %i poll denial, revalidates and recovers on retry", async status => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValue(snapshot(300, true));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByTestId("score-chart")).toBeTruthy();
    let rejectSnapshot!: (error: Error) => void;
    state.getResults.mockReturnValueOnce(new Promise((_, reject) => {rejectSnapshot = reject;}));
    state.getChanges.mockRejectedValueOnce(new ManageApiError(status));

    await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
    await waitFor(() => expect(state.getResults).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Альфа")).toBeNull();
    expect(screen.queryByTestId("score-chart")).toBeNull();
    await act(async () => {rejectSnapshot(new ManageApiError(status));});
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Альфа")).toBeNull();
    expect(screen.queryByTestId("score-chart")).toBeNull();

    fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"}));
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByTestId("score-chart")).toBeTruthy();
});

it("uses the snapshot's closed reason after a poll denies access", async () => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValueOnce(snapshot(300, true)).mockRejectedValue(new ResultsUnavailableError("participants_only"));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    state.getChanges.mockRejectedValueOnce(new ManageApiError(403));
    await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
    expect(await screen.findByText("Рейтинг доступний лише учасникам")).toBeTruthy();
    expect(screen.queryByText("Альфа")).toBeNull();
    expect(screen.queryByTestId("score-chart")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
});

it("suppresses a cached chart when a snapshot refresh definitively denies access", async () => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValueOnce(snapshot(300, true)).mockRejectedValueOnce(new ManageApiError(404))
        .mockRejectedValueOnce(new ManageApiError(503)).mockResolvedValue(snapshot(300, true));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    state.getChanges.mockResolvedValueOnce({Revision: 2, Changes: [], SnapshotRequired: true, FreezeKey: ""});
    await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Альфа")).toBeNull();
    expect(screen.queryByTestId("score-chart")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"}));
    await screen.findByText("Код помилки: 503");
    expect(screen.queryByText("Альфа")).toBeNull();
    expect(screen.queryByTestId("score-chart")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"}));
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByTestId("score-chart")).toBeTruthy();
});

it.each([new TypeError("offline"), new ManageApiError(503)])("preserves cached results after a transient poll failure: %s", async error => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValue(snapshot(300, true));
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    state.getChanges.mockRejectedValueOnce(error);
    await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
    await waitFor(() => expect(state.getChanges).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Альфа")).toBeTruthy();
    expect(screen.getByTestId("score-chart")).toBeTruthy();
    expect(state.getResults).toHaveBeenCalledTimes(1);
});

it.each([new TypeError("offline"), new ManageApiError(503)])("preserves cached results after a transient snapshot failure: %s", async error => {
    state.event = event(-hour, "available");
    state.getResults.mockResolvedValueOnce(snapshot(300, true)).mockRejectedValue(error);
    renderView();
    expect(await screen.findByText("Альфа")).toBeTruthy();
    state.getChanges.mockResolvedValueOnce({Revision: 2, Changes: [], SnapshotRequired: true, FreezeKey: ""});
    await act(async () => {focusManager.setFocused(false); focusManager.setFocused(true);});
    await waitFor(() => expect(state.getResults).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Альфа")).toBeTruthy();
    expect(screen.getByTestId("score-chart")).toBeTruthy();
});

it("explains a closed ranking inside the table block, without the search, the columns or the poll status", () => {
    state.event = event(-hour, "participants_only");
    renderView();
    expect(screen.getByText("Рейтинг доступний лише учасникам")).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("columnheader")).toBeNull();
    expect(screen.queryByText("Автооновлення")).toBeNull();
    expect(state.getResults).not.toHaveBeenCalled();
});

it("before the start a «not started» answer leaves only the countdown, never «hidden by the organizer»", async () => {
    for (const countdown of [true, false]) {
        cleanup();
        state.event = {...event(hour, "available"), ShowStartCountdown: countdown};
        state.getResults.mockRejectedValue(new ResultsUnavailableError("not_started"));
        renderView();
        // With the start countdown its line says it; without one the block does, once either way.
        expect((await screen.findAllByText("Рейтинг зʼявиться після старту")).length).toBe(1);
        expect(screen.queryByRole("timer") !== null).toBe(countdown);
    }
    expect(screen.queryByText("Рейтинг приховано організатором")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("columnheader")).toBeNull();
    expect(screen.queryByText("Автооновлення")).toBeNull();
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
                expect(screen.getByText("Автооновлення")).toBeTruthy();
                expect(screen.getByText(/^Оновлено /)).toBeTruthy();
                const plot = screen.queryByTestId("chart-plot");
                expect(plot !== null).toBe(chart);
                if (plot) expect(plot.textContent).toBe(phase === "before" ? "Графік зʼявиться після початку" : "");
            }
            // Live is a staff screen opened from /manage: never on this page.
            expect(screen.queryByRole("link", {name: "Відкрити результати наживо"})).toBeNull();
        });
    }
});
