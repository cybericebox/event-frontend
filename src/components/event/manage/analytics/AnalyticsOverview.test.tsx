// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null, StartTime: ""}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: unknown[]}}) => <div data-testid="chart" data-series={option.series.length} />}));
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
        Leaders: [
            {TeamID: "0190c6a4-0000-7000-8000-000000000001", Name: "Blue", Rank: 1, Points: 300, Solved: 3, Gap: 0},
            {TeamID: "0190c6a4-0000-7000-8000-000000000003", Name: "Red", Rank: 2, Points: 250, Solved: 2, Gap: 50},
        ],
        RankedTeams: 2,
        Tasks: {Total: 8, Unsolved: 3, FirstBloods: 5, MostSolved: {ChallengeID: "0190c6a4-0000-7000-8000-000000000011", Name: "Web 1", Solves: 4}, LeastSolved: {ChallengeID: "0190c6a4-0000-7000-8000-000000000012", Name: "Pwn 2", Solves: 1}},
        Engagement: {Teams: 4, TeamsSolving: 3, AvgSolves: 1.5},
        Comms: {EmailSent: 18, EmailFailed: 2, Since: past},
        RefreshedAt: null, Final: false, ...extra,
    };
}

function mockApi(body: unknown, status = 200) {
    const calls: string[] = [];
    // The page decides its phase from the event itself.
    event.StartTime = (body as {Markers?: {StartAt: string}} | null)?.Markers?.StartAt ?? past;
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
        expect(screen.getByTestId("chart").getAttribute("data-series")).toBe("5");
        const feed = screen.getByRole("region", {name: "Стрічка подій"});
        expect(within(feed).getByText("«Blue» — перша кров у «Web 1»")).toBeTruthy();
        expect(within(feed).getByText("Стенд команди «Red» не запустився")).toBeTruthy();
        expect(within(feed).getByText("no capacity")).toBeTruthy();
        expect(screen.getByText("Автооновлення")).toBeTruthy();
        expect(calls.some(url => url.endsWith("/manage/analytics/overview"))).toBe(true);
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

    it("shows only the registration counters before the start, no setup checklist", async () => {
        mockApi(overview({Markers: {StartAt: future, FreezeAt: null, FinishAt: null}, Series: [], Feed: []}));
        renderOverview();
        const registration = await screen.findByRole("region", {name: "Реєстрація"});
        expect(within(registration).getByText("Очікують рішення")).toBeTruthy();
        expect(within(registration).getByText("Запрошені")).toBeTruthy();
        expect(screen.queryByLabelText("Етапи підготовки")).toBeNull();
        expect(screen.queryByTestId("chart")).toBeNull();
    });

    it("shows a load error with a retry instead of a half page", async () => {
        mockApi(null, 500);
        renderOverview();
        expect(await screen.findByText("Не вдалося завантажити огляд")).toBeTruthy();
        expect(screen.getAllByRole("button", {name: "Спробувати ще раз"})).toHaveLength(1);
    });
});

// The strip is there while loading too; wait for its text, then take it.
async function strip(text: string) {
    await screen.findByText(text);
    return screen.getByRole("region", {name: "Стан заходу"});
}

describe("Огляд: status strip", () => {
    it("counts down to the start and shows the registration progress", async () => {
        mockApi(overview({Markers: {StartAt: future, FreezeAt: null, FinishAt: null}, Series: [], Feed: []}));
        renderOverview();
        const bar = await strip("До старту");
        expect(within(bar).getByText("До старту")).toBeTruthy();
        expect(within(bar).getByText("До початку")).toBeTruthy();
        expect(within(bar).getByText("Затверджено 10 із 12")).toBeTruthy();
        expect(within(bar).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("83");
    });

    it("shows the elapsed and remaining time with a progress bar while running", async () => {
        mockApi(overview());
        renderOverview();
        const bar = await strip("Захід триває");
        expect(within(bar).getByText("Захід триває")).toBeTruthy();
        expect(within(bar).getByText("1 год")).toBeTruthy();
        expect(within(bar).getByText("Залишилось")).toBeTruthy();
        expect(within(bar).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    });

    it("says «Завершено» with the duration after the finish, and keeps the manual refresh", async () => {
        const start = new Date(Date.now() - 5 * 3_600_000).toISOString();
        const finish = new Date(Date.now() - 3_600_000).toISOString();
        mockApi(overview({Final: true, Markers: {StartAt: start, FreezeAt: null, FinishAt: finish}}));
        renderOverview();
        const bar = await strip("Завершено");
        expect(within(bar).getByText("Завершено")).toBeTruthy();
        expect(within(bar).getByText("Тривалість")).toBeTruthy();
        expect(within(bar).getByText("4 год")).toBeTruthy();
        expect(within(bar).queryByRole("progressbar")).toBeNull();
        expect(screen.getByRole("button", {name: /Оновити/})).toBeTruthy();
    });
});

describe("Огляд: cards", () => {
    it("shows the leaders with the gap, the task snapshot and the engagement, each linking to its section", async () => {
        mockApi(overview());
        renderOverview();
        await screen.findByText("Blue");
        const leaders = screen.getByRole("region", {name: "Лідери"});
        expect(within(leaders).getByText("Blue")).toBeTruthy();
        expect(within(leaders).getByText("Лідер")).toBeTruthy();
        expect(within(leaders).getByText("−50 б. до першого")).toBeTruthy();
        expect(within(leaders).getByRole("link", {name: /Результати/}).getAttribute("href")).toBe("/scoreboard");

        const tasks = screen.getByRole("region", {name: "Завдання"});
        expect(within(tasks).getByText("3 із 8")).toBeTruthy();
        expect(within(tasks).getByText("Web 1 (4)")).toBeTruthy();
        expect(within(tasks).getByText("Pwn 2 (1)")).toBeTruthy();
        expect(within(tasks).getByText("5 із 8")).toBeTruthy();
        expect(within(tasks).getAllByRole("link").every(link => link.getAttribute("href") === "/manage/analytics/tasks")).toBe(true);

        const engagement = screen.getByRole("region", {name: "Залученість"});
        expect(within(engagement).getByText("4 із 10")).toBeTruthy();
        expect(within(engagement).getByText("3 із 4 (75%)")).toBeTruthy();
        expect(within(engagement).getByText("1,5")).toBeTruthy();
    });

    it("links the stat tiles to their sections", async () => {
        mockApi(overview());
        renderOverview();
        const stats = await screen.findByRole("region", {name: "Ключові числа"});
        expect(within(stats).getByRole("link", {name: "40"}).getAttribute("href")).toBe("/manage/analytics/tasks");
        expect(within(stats).getByRole("link", {name: "12"}).getAttribute("href")).toBe("/manage/analytics/participants");
    });

    it("shows the stands card only for an event with stands", async () => {
        mockApi(overview());
        renderOverview();
        const stands = await screen.findByRole("region", {name: "Стенди"});
        expect(within(stands).getByRole("link", {name: /Стенди/}).getAttribute("href")).toBe("/manage/analytics/stands");
        cleanup();
        mockApi(overview({Stands: {Creating: 0, Ready: 0, Failed: 0}}));
        renderOverview();
        await screen.findByRole("region", {name: "Ключові числа"});
        expect(screen.queryByRole("region", {name: "Стенди"})).toBeNull();
    });

    it("shows the mail card only when the server sent it (the sensitive access)", async () => {
        mockApi(overview());
        renderOverview();
        const comms = await screen.findByRole("region", {name: "Комунікації"});
        expect(within(comms).getByText("18")).toBeTruthy();
        expect(within(comms).getByRole("link", {name: /Комунікації/}).getAttribute("href")).toBe("/manage/analytics/communications");
        cleanup();
        mockApi(overview({Comms: null}));
        renderOverview();
        await screen.findByRole("region", {name: "Ключові числа"});
        expect(screen.queryByRole("region", {name: "Комунікації"})).toBeNull();
    });

    it("says so, inside the card, when there is nothing to list", async () => {
        mockApi(overview({Leaders: [], RankedTeams: 0, Tasks: {Total: 0, Unsolved: 0, FirstBloods: 0, MostSolved: null, LeastSolved: null}, Engagement: {Teams: 0, TeamsSolving: 0, AvgSolves: 0}, Comms: {EmailSent: 0, EmailFailed: 0, Since: past}}));
        renderOverview();
        expect(await screen.findByText("Поки що немає команд у рейтингу")).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Завдання"})).getByText("У заході ще немає завдань")).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Залученість"})).getByText("Ще немає допущених команд")).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Комунікації"})).getByText("За останню добу листів не надсилали")).toBeTruthy();
    });

    it("shows one loader for the first load and no cards yet", () => {
        globalThis.fetch = vi.fn(() => new Promise<Response>(() => {})) as typeof fetch;
        renderOverview();
        expect(screen.getAllByRole("status")).toHaveLength(1);
        expect(screen.queryByRole("region", {name: "Завдання"})).toBeNull();
        expect(screen.queryByRole("region", {name: "Лідери"})).toBeNull();
    });

    it("keeps the same cards before the start, with «Захід ще не почався» in leaders and engagement", async () => {
        mockApi(overview({Markers: {StartAt: future, FreezeAt: null, FinishAt: null}, Series: [], Feed: [], Leaders: [], RankedTeams: 0}));
        renderOverview();
        const leaders = await screen.findByRole("region", {name: "Лідери"});
        expect(within(leaders).getByText("Захід ще не почався")).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Залученість"})).getByText("Захід ще не почався")).toBeTruthy();
        const tasks = screen.getByRole("region", {name: "Завдання"});
        expect(within(tasks).getByText("Завдань у заході")).toBeTruthy();
        expect(within(tasks).getByText("8")).toBeTruthy();
        expect(screen.getByRole("region", {name: "Динаміка балів"})).toBeTruthy();
        expect(screen.getByRole("region", {name: "Стенди"})).toBeTruthy();
        expect(screen.getByRole("region", {name: "Комунікації"})).toBeTruthy();
    });

    it("has the same set of blocks in every phase apart from the activity / registrations swap", async () => {
        const names = () => screen.getAllByRole("region").map(region => region.getAttribute("aria-label")).filter(name => name !== "Активність" && name !== "Реєстрації" && name !== "Ключові числа" && name !== "Реєстрація");
        mockApi(overview());
        renderOverview();
        await screen.findByRole("region", {name: "Динаміка балів"});
        const running = names();
        cleanup();
        mockApi(overview({Markers: {StartAt: future, FreezeAt: null, FinishAt: null}, Series: []}));
        renderOverview();
        await screen.findByRole("region", {name: "Динаміка балів"});
        expect(names()).toEqual(running);
    });

    it("shows one load error for the whole page when the overview fails", async () => {
        mockApi(null, 500);
        renderOverview();
        expect(await screen.findByText("Не вдалося завантажити огляд")).toBeTruthy();
        expect(screen.getAllByRole("button", {name: "Спробувати ще раз"})).toHaveLength(1);
        expect(screen.queryByRole("region", {name: "Завдання"})).toBeNull();
    });
});

describe("feed wording", () => {
    it("writes one line per kind", () => {
        const base = {At: past, TeamID: null, TeamName: "Blue", ChallengeName: "Web 1", Detail: ""};
        expect(feedText({...base, Kind: "team_created"})).toBe("Нова команда «Blue»");
        expect(feedText({...base, Kind: "freeze_started"})).toBe("Таблицю результатів заморожено");
    });
});
