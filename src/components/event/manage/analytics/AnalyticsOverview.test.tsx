// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("@/components/event/manage/exercises/ChallengeBlockers", () => ({ChallengeBlockers: () => <div data-testid="blockers" />}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: unknown[]}}) => <div data-testid="chart" data-series={option.series.length} />}));
vi.mock("@/api/manage", async original => ({
    ...(await original() as object),
    getManageConfig: async () => ({Participation: 1, MaxTeamSize: 4}),
    getManageLifecycle: async () => ({Configured: true, JoinPolicy: 0}),
}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {AnalyticsOverview, feedText} from "./AnalyticsOverview";

afterEach(cleanup);

const past = new Date(Date.now() - 3_600_000).toISOString();
const future = new Date(Date.now() + 3_600_000).toISOString();

function overview(extra: Record<string, unknown> = {}) {
    return {
        Participants: {Registered: 12, Approved: 10, Pending: 1, Invited: 2, Active: 4},
        Teams: {Total: 5, Admitted: 3, Incomplete: 2},
        Attempts: 40, Correct: 10, Solves: 6, HintsOpened: 2, HintPoints: 30,
        Stands: {Creating: 0, Ready: 3, Failed: 1},
        Series: [{At: past, Attempts: 3, Correct: 1, Solves: 1, Opens: 2}],
        Feed: [
            {Kind: "first_blood", At: past, TeamID: "0190c6a4-0000-7000-8000-000000000001", TeamName: "Blue", ChallengeName: "Web 1", Detail: ""},
            {Kind: "stand_failed", At: past, TeamID: "0190c6a4-0000-7000-8000-000000000002", TeamName: "Red", ChallengeName: "", Detail: "no capacity"},
        ],
        Markers: {StartAt: past, FreezeAt: null, FinishAt: future},
        Period: {From: past, To: future},
        RefreshedAt: null, Final: false, ...extra,
    };
}

function mockApi(body: unknown, status = 200) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        return new Response(JSON.stringify(status === 200 ? {Status: {Code: 0}, Data: body} : {Status: {Code: 1}}), {status});
    }) as typeof fetch;
    return calls;
}

function renderOverview() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><AnalyticsOverview /></QueryClientProvider>);
}

describe("Огляд", () => {
    it("shows the counters, the activity chart and the feed of a running event", async () => {
        const calls = mockApi(overview());
        renderOverview();
        expect(screen.getByRole("status", {name: "Завантажуємо огляд"})).toBeTruthy();
        const stats = await screen.findByRole("region", {name: "Ключові числа"});
        expect(within(stats).getByText("Допущені команди")).toBeTruthy();
        expect(within(stats).getByText("Правильних: 10 (25%)")).toBeTruthy();
        expect(within(stats).getByText("Стенди готові")).toBeTruthy();
        expect(screen.getByTestId("chart").getAttribute("data-series")).toBe("4");
        const feed = screen.getByRole("region", {name: "Стрічка подій"});
        expect(within(feed).getByText("«Blue» — перша кров у «Web 1»")).toBeTruthy();
        expect(within(feed).getByText("Стенд команди «Red» не запустився")).toBeTruthy();
        expect(within(feed).getByText("no capacity")).toBeTruthy();
        expect(screen.getByText("Автооновлення")).toBeTruthy();
        expect(calls.some(url => url.endsWith("/manage/analytics/overview"))).toBe(true);
        expect(screen.queryByTestId("blockers")).toBeNull();
    });

    it("leaves out team counters for an individual event and stands without any", async () => {
        event.Participation = 0;
        mockApi(overview({Stands: {Creating: 0, Ready: 0, Failed: 0}}));
        renderOverview();
        const stats = await screen.findByRole("region", {name: "Ключові числа"});
        expect(within(stats).queryByText("Допущені команди")).toBeNull();
        expect(within(stats).queryByText("Стенди готові")).toBeNull();
        event.Participation = 1;
    });

    it("says so, inside the chart block, when nothing happened in the period", async () => {
        mockApi(overview({Series: [{At: past, Attempts: 0, Correct: 0, Solves: 0, Opens: 0}], Feed: []}));
        renderOverview();
        await screen.findByRole("region", {name: "Ключові числа"});
        expect(screen.queryByTestId("chart")).toBeNull();
        expect(within(screen.getByRole("img", {name: "Активність"})).getByText("У цей період ще не було активності")).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Стрічка подій"})).getByText("Поки що нічого не сталося")).toBeTruthy();
    });

    it("shows the readiness checklist and the registration counters before the start", async () => {
        mockApi(overview({Markers: {StartAt: future, FreezeAt: null, FinishAt: null}, Series: [], Feed: []}));
        renderOverview();
        const registration = await screen.findByRole("region", {name: "Реєстрація"});
        expect(within(registration).getByText("Очікують рішення")).toBeTruthy();
        expect(within(registration).getByText("Запрошені")).toBeTruthy();
        expect(screen.getByTestId("blockers")).toBeTruthy();
        await waitFor(() => expect(screen.getByLabelText("Етапи підготовки")).toBeTruthy());
        expect(screen.queryByTestId("chart")).toBeNull();
    });

    it("shows a load error with a retry instead of a half page", async () => {
        mockApi(null, 500);
        renderOverview();
        expect(await screen.findByText("Не вдалося завантажити огляд")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    });
});

describe("feed wording", () => {
    it("writes one line per kind", () => {
        const base = {At: past, TeamID: null, TeamName: "Blue", ChallengeName: "Web 1", Detail: ""};
        expect(feedText({...base, Kind: "team_created"})).toBe("Нова команда «Blue»");
        expect(feedText({...base, Kind: "freeze_started"})).toBe("Таблицю результатів заморожено");
    });
});
