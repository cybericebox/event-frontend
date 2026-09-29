// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: unknown[]}}) => <div data-testid="chart" data-series={option.series.length} />}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {AnalyticsProgress} from "./AnalyticsProgress";

afterEach(cleanup);

const past = new Date(Date.now() - 3_600_000).toISOString();
const future = new Date(Date.now() + 3_600_000).toISOString();
const period = {From: past, To: future};
const team = (id: string, name: string, points: number, extra: Record<string, unknown> = {}) => ({TeamID: id, Name: name, Points: points, Solved: points > 0 ? 1 : 0, Rank: 1, Hidden: false, Admitted: true, Selected: true, ...extra});

const scores = {
    Teams: [team("a", "Blue", 100), team("b", "Red", 50, {Rank: 2, Selected: false})],
    Series: [{TeamID: "a", Name: "Blue", Points: [{At: past, Score: 0}, {At: past, Score: 100}]}],
    Period: period,
};
const matrix = {
    Tasks: [{ChallengeID: "c1", Name: "Web 1", GroupName: "Web"}, {ChallengeID: "c2", Name: "Pwn 1", GroupName: ""}],
    Teams: [{TeamID: "a", Name: "Blue", Points: 100, Solved: 1}, {TeamID: "b", Name: "Red", Points: 50, Solved: 0}],
    Cells: [{TeamID: "a", ChallengeID: "c1", Attempts: 2, SolvedAt: past}, {TeamID: "b", ChallengeID: "c1", Attempts: 3, SolvedAt: null}],
    Period: period,
};
const heatmap = {
    Hours: [past], Teams: matrix.Teams, Cells: [{TeamID: "a", HourAt: past, Attempts: 2, Opens: 1, Solves: 1, Activity: 4}], MaxActivity: 4, Period: period, RefreshedAt: null, Final: false,
};
const inactive = {Minutes: 30, AsOf: new Date().toISOString(), Running: true, Teams: [{TeamID: "b", Name: "Red", LastActivityAt: null, IdleMinutes: 90, Points: 50}]};

function mockApi(overrides: Record<string, unknown> = {}) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const reply = (data: unknown) => new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
        if (url.includes("/progress/scores")) return reply(overrides.scores ?? scores);
        if (url.includes("/progress/matrix")) return reply(overrides.matrix ?? matrix);
        if (url.includes("/progress/heatmap")) return reply(overrides.heatmap ?? heatmap);
        if (url.includes("/progress/inactive")) return reply(overrides.inactive ?? inactive);
        return new Response("{}", {status: 404});
    }) as typeof fetch;
    return calls;
}

function renderProgress() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><AnalyticsProgress /></QueryClientProvider>);
}

describe("Прогрес", () => {
    it("shows the score chart, the matrix, the heatmap and the idle teams", async () => {
        const calls = mockApi();
        renderProgress();
        expect(screen.getAllByRole("status", {name: "Завантажуємо прогрес"}).length).toBeGreaterThan(0);
        const matrixBlock = await screen.findByRole("region", {name: "Команди й завдання"});
        expect(await within(matrixBlock).findByText("Blue")).toBeTruthy();
        const rows = within(matrixBlock).getAllByRole("row");
        // Blue solved Web 1 and never touched Pwn 1; Red tried Web 1 three times.
        expect(within(rows[1]).getByTitle(/Розв'язано .*спроб: 2/)).toBeTruthy();
        expect(within(rows[2]).getByTitle("Спроб: 3, без розв'язання")).toBeTruthy();
        expect(screen.getAllByTestId("chart")).toHaveLength(2);
        const idle = screen.getByRole("region", {name: "Неактивні команди"});
        expect(await within(idle).findByText("1 год 30 хв")).toBeTruthy();
        expect(within(idle).getByText("Ще не було")).toBeTruthy();
        expect(calls.some(url => url.includes("/progress/scores?top=10"))).toBe(true);
        expect(calls.some(url => url.includes("/progress/inactive?minutes=30"))).toBe(true);
    });

    it("adds a chosen team to the chart request and removes it again", async () => {
        const calls = mockApi();
        renderProgress();
        const scoresBlock = await screen.findByRole("region", {name: "Рахунок у часі"});
        await waitFor(() => expect(within(scoresBlock).getByRole("button", {name: "Додати команду"}).hasAttribute("disabled")).toBe(false));
        fireEvent.pointerDown(within(scoresBlock).getByRole("button", {name: "Додати команду"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Red"}));
        await waitFor(() => expect(calls.some(url => url.includes("teams=b"))).toBe(true));
        fireEvent.click(within(scoresBlock).getByRole("button", {name: "Прибрати Red"}));
        expect(within(scoresBlock).queryByRole("button", {name: "Прибрати Red"})).toBeNull();
    });

    it("says what is missing inside each block", async () => {
        mockApi({
            scores: {...scores, Series: []}, heatmap: {...heatmap, Cells: [], MaxActivity: 0}, matrix: {...matrix, Tasks: [], Cells: []},
            inactive: {...inactive, Running: false, Teams: []},
        });
        renderProgress();
        expect(await screen.findByText("Ще немає розв'язань, щоб побудувати рахунок.")).toBeTruthy();
        expect(screen.getByText("За цей період активності ще немає.")).toBeTruthy();
        expect(screen.getByText("Ще немає команд або завдань.")).toBeTruthy();
        expect(screen.getByText("Захід ще не почався.")).toBeTruthy();
        expect(screen.queryByTestId("chart")).toBeNull();
    });

    it("says when nobody is idle", async () => {
        mockApi({inactive: {...inactive, Teams: []}});
        renderProgress();
        expect(await screen.findByText("Немає команд без дій довше за 30 хв.")).toBeTruthy();
    });

    it("shows a load error in every block", async () => {
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({Status: {Code: 1}}), {status: 500})) as typeof fetch;
        renderProgress();
        await waitFor(() => expect(screen.getAllByText("Не вдалося завантажити прогрес").length).toBe(4));
    });
});
