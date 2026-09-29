// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: unknown[]}}) => <div data-testid="chart" data-series={option.series.length} />}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {AnalyticsScoresSchema} from "@/api/manageAnalyticsTasks";
import {AnalyticsOverview} from "./AnalyticsOverview";
import {registrationsOverviewOption, scoresOverviewOption} from "./OverviewCharts";

afterEach(cleanup);

const past = new Date(Date.now() - 3_600_000).toISOString();
const future = new Date(Date.now() + 3_600_000).toISOString();
const soon = new Date(Date.now() + 1_800_000).toISOString();

const scores = AnalyticsScoresSchema.parse({
    Teams: [], Period: {From: past, To: future},
    Series: [
        {TeamID: "a", Name: "Blue", Points: [{At: past, Score: 0}, {At: soon, Score: 100}]},
        {TeamID: "b", Name: "Red", Points: [{At: past, Score: 0}, {At: soon, Score: 50}]},
    ],
});

const overview = (extra: Record<string, unknown> = {}) => ({
    Participants: {Registered: 12, Approved: 10, Pending: 1, Invited: 2, Active: 4}, Teams: {Total: 5, Admitted: 3, Incomplete: 2},
    Attempts: 40, Correct: 10, Solves: 6, HintsOpened: 2, HintPoints: 30, Stands: {Creating: 0, Ready: 0, Failed: 0},
    Series: [{At: past, Attempts: 3, Correct: 1, Solves: 1, Opens: 2}], Feed: [],
    Markers: {StartAt: past, FreezeAt: null, FinishAt: future}, Period: {From: past, To: future}, RefreshedAt: null, Final: false, ...extra,
});

function mockApi(routes: {overview: unknown; scores?: unknown; participants?: unknown}) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const body = url.includes("/progress/scores") ? routes.scores : url.includes("/analytics/participants") ? routes.participants : routes.overview;
        return body === undefined ? new Response("{}", {status: 500}) : new Response(JSON.stringify({Status: {Code: 0}, Data: body}), {status: 200});
    }) as typeof fetch;
    return calls;
}

function renderOverview() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><AnalyticsOverview /></QueryClientProvider>);
}

describe("score option", () => {
    it("draws smooth lines and marks «Зараз» only inside the period", () => {
        const option = scoresOverviewOption(scores, Date.now());
        expect(option.series.every(series => series.smooth && series.step === undefined)).toBe(true);
        expect(option.series[0].markLine?.data.map(mark => mark.name)).toEqual(["Зараз"]);
        expect(scoresOverviewOption(scores).series[0].markLine).toBeUndefined();
        expect(scoresOverviewOption(scores, Date.now() + 10 * 3_600_000).series[0].markLine).toBeUndefined();
    });
});

describe("registrations option", () => {
    it("adds the days up: the total and each channel", () => {
        const option = registrationsOverviewOption({Total: 6, Days: [{Day: "2026-09-01", Open: 1, Approval: 1, Invitation: 0}, {Day: "2026-09-02", Open: 2, Approval: 0, Invitation: 2}]});
        expect(option.series.map(series => series.data.map(point => point[1]))).toEqual([[2, 6], [1, 3], [1, 1], [0, 2]]);
    });
});

describe("Огляд: score and registration charts", () => {
    it("draws the score dynamics of a running event next to the activity chart", async () => {
        mockApi({overview: overview(), scores});
        renderOverview();
        const card = await screen.findByRole("region", {name: "Динаміка балів"});
        await within(card).findByTestId("chart");
        expect(within(card).getByTestId("chart").getAttribute("data-series")).toBe("2");
    });

    it("says so inside the card when nobody has scored", async () => {
        mockApi({overview: overview(), scores: {...scores, Series: [{TeamID: "a", Name: "Blue", Points: [{At: past, Score: 0}]}]}});
        renderOverview();
        expect(await screen.findByText("Балів ще ніхто не здобув")).toBeTruthy();
    });

    it("shows an error inside the card when only the score request fails", async () => {
        mockApi({overview: overview()});
        renderOverview();
        const card = await screen.findByRole("region", {name: "Динаміка балів"});
        expect(await within(card).findByText("Не вдалося завантажити динаміку балів")).toBeTruthy();
        expect(screen.getByRole("region", {name: "Ключові числа"})).toBeTruthy();
    });

    it("hides the score card and shows the registrations before the start", async () => {
        const participants = {
            TeamMode: true, Funnel: [], Registrations: {Total: 3, Days: [{Day: "2026-09-01", Open: 2, Approval: 1, Invitation: 0}]},
            Teams: {Histogram: [], Incomplete: []}, Answers: {Respondents: 0, Questions: []}, DropOff: {Total: 0, Rows: []}, Period: {From: null, To: null},
        };
        mockApi({overview: overview({Markers: {StartAt: future, FreezeAt: null, FinishAt: null}, Series: []}), participants});
        renderOverview();
        const card = await screen.findByRole("region", {name: "Реєстрації"});
        expect((await within(card).findByTestId("chart")).getAttribute("data-series")).toBe("4");
        expect(screen.queryByRole("region", {name: "Динаміка балів"})).toBeNull();
        expect(screen.queryByRole("region", {name: "Активність"})).toBeNull();
    });
});
