// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
const download = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: unknown[]}}) => <div data-testid="chart" data-series={option.series.length} />}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/csvDownload", async original => ({...(await original() as object), downloadManageFile: download}));

import {AnalyticsIntegrity} from "./AnalyticsIntegrity";
import {AnalyticsReport} from "./AnalyticsReport";
import {AnalyticsStands} from "./AnalyticsStands";

afterEach(cleanup);
beforeEach(() => download.mockClear());

const past = new Date(Date.now() - 3_600_000).toISOString();
const challenge = "0190c6a4-0000-7000-8000-0000000000aa";
const blue = "0190c6a4-0000-7000-8000-000000000001";
const red = "0190c6a4-0000-7000-8000-000000000002";

// Answers by the last path segment of the analytics URL.
function mockApi(routes: Record<string, unknown>) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const route = url.split("/manage/analytics/")[1]?.split("?")[0] ?? "";
        return new Response(JSON.stringify({Status: {Code: 0}, Data: routes[route]}), {status: routes[route] === undefined ? 404 : 200});
    }) as typeof fetch;
    return calls;
}

function renderWith(node: React.ReactElement) {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>);
}

const summary = {Teams: 2, Ready: 1, Creating: 0, Failed: 1, NotDeployed: 0, DeployAvgSeconds: 90, DeployMedianSeconds: 90, DeployMaxSeconds: 120,
    Failures: 1, Unresolved: 1, RecoveryAvgSeconds: null, RecoveryMaxSeconds: null, Restarts: 3, VPNTeams: 1, VPNSessions: 2, VPNRxBytes: 1024, VPNTxBytes: 2048};

function stands(extra: Record<string, unknown> = {}) {
    return {
        Available: true, Summary: summary, Period: {From: past, To: past},
        Teams: [
            {TeamID: blue, TeamName: "Blue", Status: "ready", Reason: "", StatusChangedAt: past, DeploySeconds: 90, Generations: 1, FailureCount: 0, Unresolved: 0, RecoveryAvgSeconds: null, RecoveryMaxSeconds: null, Failures: [],
                Resources: {Devices: 2, PeakCPUMillicores: 1500, PeakMemoryBytes: 3 * 1024 ** 3, Restarts: 3, RestartedDevices: 1}, VPN: {Sessions: 2, Users: 2, Members: 3, Seconds: 600, RxBytes: 1024, TxBytes: 2048, LastAt: past}},
            {TeamID: red, TeamName: "Red", Status: "failed", Reason: "no capacity", StatusChangedAt: past, DeploySeconds: null, Generations: 1, FailureCount: 1, Unresolved: 1, RecoveryAvgSeconds: null, RecoveryMaxSeconds: null,
                Failures: [{Source: "stand", Task: "", At: past, Reason: "no capacity", RecoveredAt: null, RecoverySeconds: null}],
                Resources: {Devices: 0, PeakCPUMillicores: 0, PeakMemoryBytes: 0, Restarts: 0, RestartedDevices: 0}, VPN: {Sessions: 0, Users: 0, Members: 2, Seconds: 0, RxBytes: 0, TxBytes: 0, LastAt: null}},
        ],
        ...extra,
    };
}

describe("Стенди", () => {
    it("says so, in a block, when the event has no infrastructure", async () => {
        mockApi({stands: stands({Available: false, Teams: []})});
        renderWith(<AnalyticsStands />);
        expect(await screen.findByText("У цьому заході немає інфраструктури, тож стендів немає")).toBeTruthy();
        expect(screen.queryByRole("table")).toBeNull();
    });

    it("shows the summary, the deploy chart and a row per team", async () => {
        mockApi({stands: stands()});
        renderWith(<AnalyticsStands />);
        const numbers = await screen.findByRole("region", {name: "Ключові числа стендів"});
        expect(within(numbers).getByText("1 / 2")).toBeTruthy();
        expect(within(numbers).getByText("Середнє 1 хв 30 с, найдовше 2 хв")).toBeTruthy();
        expect(screen.getByTestId("chart").getAttribute("data-series")).toBe("1");
        const table = screen.getByRole("table");
        const blueRow = within(table).getByText("Blue").closest("tr")!;
        expect(within(blueRow).getByText("Готовий")).toBeTruthy();
        expect(within(blueRow).getByText("1,5 vCPU")).toBeTruthy();
        expect(within(blueRow).getByText("2 з 3 учасників")).toBeTruthy();
        const redRow = within(table).getByText("Red").closest("tr")!;
        expect(within(redRow).getByText("Збій")).toBeTruthy();
        expect(within(redRow).getByText("не усунено: 1")).toBeTruthy();
        expect(within(redRow).getByText("Не підключалися")).toBeTruthy();
    });

    it("filters teams by status and says so when none match", async () => {
        mockApi({stands: stands()});
        renderWith(<AnalyticsStands />);
        await screen.findByRole("table");
        fireEvent.change(screen.getByRole("searchbox", {name: "Пошук за командою"}), {target: {value: "nobody"}});
        expect(await screen.findByText("Немає команд за цими умовами")).toBeTruthy();
    });
});

const thresholds = {SameAnswerWindowSeconds: 120, SameAnswerMinLength: 6, IncludeCorrect: false, BurstAttempts: 15, BurstWindowSeconds: 60, FastSolveGapSeconds: 60};

function integrity() {
    return {
        Signals: [
            {Kind: "same_answer", ChallengeID: challenge, ChallengeName: "Web 1", Teams: [{ID: blue, Name: "Blue"}, {ID: red, Name: "Red"}], From: past, To: past, Answer: "flag{shared}", Correct: false, Attempts: 2, Rejections: 0, GapSeconds: 0},
            {Kind: "burst", ChallengeID: challenge, ChallengeName: "Web 1", Teams: [{ID: red, Name: "Red"}], From: past, To: past, Answer: "", Correct: false, Attempts: 20, Rejections: 4, GapSeconds: 0},
        ],
        Total: 2, SameAnswer: 1, Burst: 1, FastSolve: 0, Thresholds: thresholds, Defaults: thresholds, Period: {From: past, To: past},
    };
}

describe("Доброчесність", () => {
    it("is closed to viewers without the sensitive level and asks for nothing", async () => {
        const calls = mockApi({access: {Sections: true, Sensitive: false}});
        renderWith(<AnalyticsIntegrity />);
        expect(await screen.findByText(/Сигнали доброчесності бачать лише власник заходу/)).toBeTruthy();
        expect(calls.some(url => url.includes("/analytics/integrity"))).toBe(false);
    });

    it("lists the signals, each linking to the attempts journal filtered on it", async () => {
        mockApi({access: {Sections: true, Sensitive: true}, integrity: integrity()});
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        expect(within(table).getByText("Однакова неправильна відповідь «flag{shared}», спроб: 2")).toBeTruthy();
        expect(within(table).getByText(/20 спроб за/)).toBeTruthy();
        const links = within(table).getAllByRole("link", {name: "Журнал спроб"});
        expect(links).toHaveLength(2);
        const same = new URL(links[0].getAttribute("href")!, "https://event.test").searchParams;
        expect(same.get("challengeId")).toBe(challenge);
        expect(same.get("teamId")).toBeNull();
        const burst = new URL(links[1].getAttribute("href")!, "https://event.test").searchParams;
        expect(burst.get("teamId")).toBe(red);
        expect(screen.getByText(/IP-адреси не використовуються/)).toBeTruthy();
    });

    it("sends the applied thresholds and remembers a change of the defaults", async () => {
        const calls = mockApi({access: {Sections: true, Sensitive: true}, integrity: integrity()});
        renderWith(<AnalyticsIntegrity />);
        await screen.findByRole("table");
        const burst = screen.getByLabelText("Спроб у серії");
        fireEvent.change(burst, {target: {value: "30"}});
        fireEvent.click(screen.getByRole("button", {name: "Застосувати"}));
        await waitFor(() => expect(calls.some(url => url.includes("/analytics/integrity?") && url.includes("burstAttempts=30"))).toBe(true));
    });
});

function report(extra: Record<string, unknown> = {}) {
    return {
        Available: true, EventName: "Cyber Cup", StartAt: past, FinishAt: past, GeneratedAt: past,
        Participants: {Registered: 12, Approved: 10, Pending: 0, Invited: 0, Active: 0}, Teams: {Total: 5, Admitted: 4, Incomplete: 1},
        Tasks: 2, Attempts: 40, Correct: 10, Solves: 6, HintsOpened: 2, HintPoints: 30,
        Ranking: [
            {Rank: 1, TeamID: blue, Name: "Blue", Individual: false, Members: 3, Points: 300, Solved: 3, Attempts: 20, LastSolveAt: past},
            {Rank: 2, TeamID: red, Name: "Red", Individual: true, Members: 1, Points: 200, Solved: 2, Attempts: 20, LastSolveAt: past},
        ],
        TaskRows: [{ChallengeID: challenge, Name: "Web 1", Points: 100, TeamsOpened: 4, TeamsAttempted: 4, Attempts: 30, CorrectAttempts: 3, Solves: 3, SolveRate: 0.75, HintsUnlocked: 1, FirstSolveAt: past, FirstSolveTeam: "Blue"}],
        ParticipantFunnel: [{Key: "registered", Count: 12}, {Key: "approved", Count: 10}, {Key: "opened", Count: 8}, {Key: "attempted", Count: 7}],
        TeamFunnel: [{Key: "teams", Count: 5}, {Key: "admitted", Count: 4}, {Key: "tried", Count: 3}, {Key: "solved", Count: 2}],
        Series: [{At: past, Attempts: 3, Correct: 1, Solves: 1, Opens: 2}], Stands: null, ...extra,
    };
}

describe("Звіт по заході", () => {
    it("waits for the finish and offers nothing to print or download", async () => {
        mockApi({report: {Available: false, EventName: "Cyber Cup", StartAt: past, FinishAt: null, GeneratedAt: past, Participants: {Registered: 0, Approved: 0, Pending: 0, Invited: 0, Active: 0}, Teams: {Total: 0, Admitted: 0, Incomplete: 0},
            Tasks: 0, Attempts: 0, Correct: 0, Solves: 0, HintsOpened: 0, HintPoints: 0}});
        renderWith(<AnalyticsReport />);
        expect(await screen.findByText("Звіт буде доступний після завершення заходу")).toBeTruthy();
        expect((screen.getByRole("button", {name: /Друк/}) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", {name: /Таблиці/}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows the numbers, funnels, ranking and tasks of a finished event", async () => {
        mockApi({report: report()});
        renderWith(<AnalyticsReport />);
        expect(await screen.findByRole("heading", {name: "Cyber Cup"})).toBeTruthy();
        const numbers = screen.getByRole("region", {name: "Ключові числа заходу"});
        expect(within(numbers).getByText("Правильних: 10 (25%)")).toBeTruthy();
        expect(screen.getAllByTestId("chart").length).toBeGreaterThanOrEqual(4);
        const ranking = screen.getByRole("region", {name: "Підсумковий рейтинг"});
        expect(within(ranking).getByText("Blue")).toBeTruthy();
        expect(within(ranking).getByText("Учасників: 3")).toBeTruthy();
        const tasks = screen.getByRole("region", {name: /Завдання/});
        expect(within(tasks).getAllByText("75%").length).toBeGreaterThan(0);
    });

    it("prints and downloads the ZIP of tables", async () => {
        mockApi({report: report()});
        const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
        renderWith(<AnalyticsReport />);
        await screen.findByRole("heading", {name: "Cyber Cup"});
        fireEvent.click(screen.getByRole("button", {name: /Друк/}));
        expect(print).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", {name: /Таблиці/}));
        await waitFor(() => expect(download).toHaveBeenCalledWith(event.EventID, "analytics/report/export.zip", expect.stringMatching(/^analytics-report-\d{4}-\d{2}-\d{2}\.zip$/), "application/zip"));
    });
});
