// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: unknown[]}}) => <div data-testid="chart" data-series={option.series.length} />}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {AnalyticsTasks} from "./AnalyticsTasks";

afterEach(cleanup);

const past = new Date(Date.now() - 3_600_000).toISOString();
const future = new Date(Date.now() + 3_600_000).toISOString();
const noGroup = "00000000-0000-0000-0000-000000000000";

function task(extra: Record<string, unknown> = {}) {
    return {
        ChallengeID: "c1", Name: "Web 1", Difficulty: "easy", Points: 100, GroupID: "g1", GroupName: "Web", Attempts: 10, Correct: 4, TeamsTried: 5, TeamsOpened: 6, Solves: 4,
        SolveRate: 0.8, MedianSinceStartSeconds: 600, MedianSinceOpenSeconds: 3900, FirstBloodTeam: "Blue", FirstBloodAt: past, HintsOpened: 2, HintPoints: 20,
        Calibration: {Verdict: "ok", ExpectedMin: 0.55, ExpectedMax: 0.9}, ...extra,
    };
}

const list = {
    Tasks: [
        task(),
        task({ChallengeID: "c2", Name: "Pwn 1", GroupID: noGroup, GroupName: "", Difficulty: "hard", SolveRate: 0.9, Solves: 9, TeamsTried: 10, MedianSinceOpenSeconds: null, FirstBloodTeam: "", FirstBloodAt: null, HintsOpened: 0, HintPoints: 0,
            Calibration: {Verdict: "too_easy", ExpectedMin: 0.1, ExpectedMax: 0.45}}),
        task({ChallengeID: "c3", Name: "Rare", Difficulty: "medium", TeamsTried: 1, Solves: 0, SolveRate: 0, Calibration: {Verdict: "insufficient", ExpectedMin: 0.3, ExpectedMax: 0.7}}),
    ],
    Groups: [
        {GroupID: "g1", GroupName: "Web", Tasks: 2, Attempts: 20, TeamsTried: 6, Solves: 4, SolveRate: 0.67},
        {GroupID: noGroup, GroupName: "", Tasks: 1, Attempts: 5, TeamsTried: 10, Solves: 9, SolveRate: 0.9},
    ],
    Period: {From: past, To: future},
};

const detail = {
    Task: task(),
    Series: [{At: past, Attempts: 3, Correct: 1, Solves: 1, Opens: 2}],
    FailedTeams: [{TeamID: "t9", TeamName: "Red", Attempts: 7, LastAttemptAt: past, HintsOpened: 1}],
    HintEffect: {With: {Teams: 2, Solved: 1, SolveRate: 0.5, MedianSeconds: 300}, Without: {Teams: 3, Solved: 3, SolveRate: 1, MedianSeconds: 1500}},
    Period: {From: past, To: future}, RefreshedAt: null, Final: false,
};

function mockApi({sensitive}: {sensitive: boolean}) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const reply = (data: unknown) => new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
        if (url.endsWith("/analytics/access")) return reply({Sections: true, Sensitive: sensitive});
        if (url.includes("/wrong-answers")) return reply({Answers: [{Answer: "ICE{wrong}", Attempts: 5, Teams: 3, LastAt: past}], Period: list.Period});
        if (url.includes("/analytics/tasks/c1")) return reply(detail);
        return reply(list);
    }) as typeof fetch;
    return calls;
}

function renderTasks() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><AnalyticsTasks /></QueryClientProvider>);
}

describe("Завдання", () => {
    it("lists the tasks with the calibration verdicts and the group summary", async () => {
        mockApi({sensitive: false});
        renderTasks();
        expect(screen.getAllByRole("status", {name: "Завантажуємо завдання"}).length).toBeGreaterThan(0);
        expect(await screen.findByText("Pwn 1")).toBeTruthy();
        const table = screen.getAllByRole("table")[0];
        const rows = within(table).getAllByRole("row");
        expect(within(rows[1]).getByText("80%")).toBeTruthy();
        expect(within(rows[1]).getByText("У межах")).toBeTruthy();
        expect(within(rows[1]).getByText("1 год 05 хв")).toBeTruthy();
        expect(within(rows[2]).getByText("Простіше за заявлене")).toBeTruthy();
        expect(within(rows[3]).getByText("Замало даних")).toBeTruthy();
        expect(screen.getByRole("region", {name: "Групи завдань"})).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Групи завдань"})).getByText("Без групи")).toBeTruthy();
        expect(screen.getByTestId("chart")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Експорт CSV"})).toBeTruthy();
    });

    it("narrows the list to the mismatches and says so when nothing is left", async () => {
        mockApi({sensitive: false});
        renderTasks();
        await screen.findByText("Pwn 1");
        fireEvent.change(screen.getByRole("searchbox", {name: "Пошук завдання"}), {target: {value: "zzz"}});
        const block = screen.getAllByRole("table")[0].closest("section") as HTMLElement;
        expect(await within(block).findByText("Немає завдань за цими фільтрами.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Скинути"}));
        expect(await screen.findByText("Pwn 1")).toBeTruthy();
    });

    it("opens the drawer of a task without the wrong answers for a read-only viewer", async () => {
        const calls = mockApi({sensitive: false});
        renderTasks();
        fireEvent.click((await screen.findAllByRole("button", {name: /Web 1/}))[0]);
        const drawer = await screen.findByRole("dialog");
        expect(await within(drawer).findByText("Пробували, але не розвʼязали")).toBeTruthy();
        expect(within(drawer).getByText("Red")).toBeTruthy();
        expect(within(drawer).getByText("З підказкою")).toBeTruthy();
        expect(within(drawer).getByText("25 хв")).toBeTruthy();
        expect(within(drawer).queryByText("Найчастіші неправильні відповіді")).toBeNull();
        await waitFor(() => expect(calls.some(url => url.endsWith("/analytics/access"))).toBe(true));
        expect(calls.some(url => url.includes("/wrong-answers"))).toBe(false);
    });

    it("shows the wrong answers to the sensitive access", async () => {
        const calls = mockApi({sensitive: true});
        renderTasks();
        fireEvent.click((await screen.findAllByRole("button", {name: /Web 1/}))[0]);
        const drawer = await screen.findByRole("dialog");
        expect(await within(drawer).findByText("ICE{wrong}")).toBeTruthy();
        expect(calls.some(url => url.includes("/tasks/c1/wrong-answers"))).toBe(true);
    });

    it("shows a load error inside the table block", async () => {
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({Status: {Code: 1}}), {status: 500})) as typeof fetch;
        renderTasks();
        expect((await screen.findAllByText("Не вдалося завантажити аналітику завдань")).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", {name: "Спробувати ще раз"}).length).toBeGreaterThan(0);
    });
});
