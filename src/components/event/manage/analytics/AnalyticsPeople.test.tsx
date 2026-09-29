// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: {data: unknown[]}[]}}) => <div data-testid="chart" data-points={option.series[0].data.length} />}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {AnalyticsCommunications} from "./AnalyticsCommunications";
import {AnalyticsParticipants, filterDropOff} from "./AnalyticsParticipants";
import {funnelRows, notificationTypeLabel} from "./peopleModel";

afterEach(cleanup);

function participants(extra: Record<string, unknown> = {}) {
    return {
        TeamMode: true,
        Funnel: [
            {Stage: "invited", Count: 4}, {Stage: "registered", Count: 20}, {Stage: "approved", Count: 18},
            {Stage: "in_team", Count: 15}, {Stage: "attempted", Count: 9}, {Stage: "solved", Count: 3},
        ],
        Registrations: {Days: [{Day: "2026-09-25T00:00:00Z", Open: 3, Approval: 1, Invitation: 0}, {Day: "2026-09-26T00:00:00Z", Open: 0, Approval: 0, Invitation: 2}], Total: 6},
        Teams: {
            MinSize: 2, MaxSize: 4, Total: 5, PendingInvitees: 2, WithoutTeam: 3,
            Histogram: [{Members: 0, Teams: 0}, {Members: 1, Teams: 2}, {Members: 2, Teams: 3}, {Members: 3, Teams: 0}, {Members: 4, Teams: 0}],
            Incomplete: [{ID: "t1", Name: "Alpha", Members: 1, PendingInvitees: 2}],
        },
        Answers: {Respondents: 4, Questions: [
            {Key: "city", Label: "Місто", Input: "select", Asked: 4, Answered: 4, Distinct: 0, Buckets: [{Label: "Київ", Count: 3}, {Label: "Львів", Count: 1}], Min: null, Max: null, Avg: null},
            {Key: "nick", Label: "Нік", Input: "text", Asked: 4, Answered: 4, Distinct: 3, Buckets: [{Label: "ace", Count: 2}], Min: null, Max: null, Avg: null},
            {Key: "age", Label: "Вік", Input: "number", Asked: 4, Answered: 3, Distinct: 0, Buckets: [{Label: "20", Count: 2}, {Label: "21", Count: 1}], Min: 20, Max: 21, Avg: 20.33},
        ]},
        DropOff: {Total: 3, Rows: [
            {UserID: "u1", Name: "Ірина Коваль", Email: "ira@example.com", TeamName: "Alpha", RegisteredAt: "2026-09-25T10:00:00Z", ApprovedAt: "2026-09-25T11:00:00Z", OpenedTasks: 2},
            {UserID: "u2", Name: "", Email: "bob@example.com", TeamName: "", RegisteredAt: "2026-09-26T10:00:00Z", ApprovedAt: null, OpenedTasks: 0},
        ]},
        Period: {From: null, To: null}, ...extra,
    };
}

function mockApi(body: unknown, status = 200) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify(status === 200 ? {Status: {Code: 0}, Data: body} : {Status: {Code: 1}}), {status});
    }) as typeof fetch;
    return calls;
}

function renderWith(node: React.ReactNode) {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>);
}

describe("Учасники", () => {
    it("shows the funnel, registrations, team fill, answers and the drop-off list", async () => {
        const calls = mockApi(participants());
        renderWith(<AnalyticsParticipants />);
        await screen.findByRole("region", {name: "Ключові числа"});
        const funnel = screen.getByRole("region", {name: "Воронка участі"});
        expect(within(funnel).getByTestId("chart").getAttribute("data-points")).toBe("6");
        expect(screen.getByRole("region", {name: "Реєстрації за днями"})).toBeTruthy();
        const fill = screen.getByRole("region", {name: "Заповнення команд"});
        expect(within(fill).getByText("Alpha")).toBeTruthy();
        expect(within(fill).getByText("1 з 2")).toBeTruthy();
        expect(within(fill).getByText(/Запрошених до команд, які ще не приєдналися: 2/)).toBeTruthy();
        const answers = screen.getByRole("region", {name: "Відповіді на форму реєстрації"});
        expect(within(answers).getByText("Місто")).toBeTruthy();
        expect(within(answers).getAllByText("Відповіли: 4 з 4")).toHaveLength(2);
        expect(within(answers).getByText("ace")).toBeTruthy();
        expect(within(answers).getByText(/від 20 до 21, у середньому 20,33/)).toBeTruthy();
        const dropoff = screen.getByRole("region", {name: "Затверджені без жодної спроби"});
        expect(within(dropoff).getByText("Ірина Коваль")).toBeTruthy();
        expect(within(dropoff).getByText("bob@example.com")).toBeTruthy();
        expect(calls.some(url => url.endsWith("/manage/analytics/participants"))).toBe(true);
    });

    it("searches the drop-off list and says so when nobody matches", async () => {
        mockApi(participants());
        renderWith(<AnalyticsParticipants />);
        await screen.findByRole("region", {name: "Ключові числа"});
        const dropoff = screen.getByRole("region", {name: "Затверджені без жодної спроби"});
        fireEvent.change(within(dropoff).getByRole("searchbox"), {target: {value: "zzz"}});
        expect(within(dropoff).getByText("Нікого не знайдено")).toBeTruthy();
        fireEvent.change(within(dropoff).getByRole("searchbox"), {target: {value: "ira@"}});
        expect(within(dropoff).getByText("Ірина Коваль")).toBeTruthy();
        expect(within(dropoff).queryByText("bob@example.com")).toBeNull();
    });

    it("leaves out team fill for an individual event and shows empty states in place", async () => {
        mockApi(participants({
            TeamMode: false, Funnel: [{Stage: "registered", Count: 0}], Registrations: {Days: [], Total: 0},
            Answers: {Respondents: 0, Questions: []}, DropOff: {Total: 0, Rows: []},
        }));
        renderWith(<AnalyticsParticipants />);
        await screen.findByRole("region", {name: "Ключові числа"});
        const funnel = screen.getByRole("region", {name: "Воронка участі"});
        expect(within(funnel).getByText("Ще немає учасників")).toBeTruthy();
        expect(screen.queryByRole("region", {name: "Заповнення команд"})).toBeNull();
        expect(within(screen.getByRole("region", {name: "Відповіді на форму реєстрації"})).getByText("Форма реєстрації порожня або на неї ще ніхто не відповів")).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Затверджені без жодної спроби"})).getByText("Усі затверджені учасники вже пробували завдання")).toBeTruthy();
    });

    it("shows a load error with a retry", async () => {
        mockApi(null, 500);
        renderWith(<AnalyticsParticipants />);
        expect((await screen.findAllByRole("button", {name: "Спробувати ще раз"})).length).toBeGreaterThan(0);
    });
});

describe("Комунікації", () => {
    const body = {
        Totals: {Type: "", EmailSent: 10, EmailErrors: 2, InAppSent: 8, InAppErrors: 0, InAppCreated: 8, InAppRead: 6, ReadRate: 0.75},
        Types: [
            {Type: "participant.event.finished", EmailSent: 10, EmailErrors: 2, InAppSent: 8, InAppErrors: 0, InAppCreated: 8, InAppRead: 6, ReadRate: 0.75},
            {Type: "custom.thing", EmailSent: 0, EmailErrors: 0, InAppSent: 0, InAppErrors: 0, InAppCreated: 0, InAppRead: 0, ReadRate: null},
        ],
        Forms: [
            {ID: "f1", Title: "Реєстрація", Registration: true, Enabled: true, Assigned: 0, Completed: 0, Answers: 40, CompletionRate: null},
            {ID: "f2", Title: "Відгук", Registration: false, Enabled: true, Assigned: 20, Completed: 5, Answers: 5, CompletionRate: 0.25},
        ],
        Period: {From: null, To: null},
    };

    it("shows the totals, the types table and the form completion", async () => {
        const calls = mockApi(body);
        renderWith(<AnalyticsCommunications />);
        const stats = await screen.findByRole("region", {name: "Ключові числа"});
        expect(within(stats).getByText("Прочитано 6 із 8")).toBeTruthy();
        expect(within(stats).getByText("75%")).toBeTruthy();
        const types = screen.getByRole("region", {name: "Листи й сповіщення"});
        expect(within(types).getByText("Захід завершено")).toBeTruthy();
        expect(within(types).getByText("custom.thing", {selector: "strong"})).toBeTruthy();
        expect(within(types).getByText("6 / 8 (75%)")).toBeTruthy();
        const forms = screen.getByRole("region", {name: "Опитування й форми"});
        expect(within(forms).getByText("Форма реєстрації")).toBeTruthy();
        expect(within(forms).getByText("25%")).toBeTruthy();
        expect(calls.some(url => url.endsWith("/manage/analytics/communications"))).toBe(true);
    });

    it("says so, inside the blocks, when nothing was sent", async () => {
        mockApi({...body, Totals: {...body.Totals, EmailSent: 0, EmailErrors: 0, InAppSent: 0, InAppCreated: 0, InAppRead: 0, ReadRate: null}, Types: [], Forms: []});
        renderWith(<AnalyticsCommunications />);
        await screen.findByRole("region", {name: "Ключові числа"});
        expect(within(screen.getByRole("img", {name: "Розсилки за типами"})).getByText("У цей період нічого не надсилали")).toBeTruthy();
        expect(within(screen.getByRole("region", {name: "Опитування й форми"})).getByText("У заході ще немає форм")).toBeTruthy();
    });
});

describe("people model", () => {
    it("shows each funnel stage's share of the previous one", () => {
        const rows = funnelRows(participants().Funnel as never);
        expect(rows[1].ofPrevious).toBe("500%");
        expect(rows[2].ofFirst).toBe("90%");
        expect(rows[0].ofPrevious).toBe("—");
    });

    it("filters the drop-off list by name, email or team", () => {
        const rows = participants().DropOff.Rows;
        expect(filterDropOff(rows, "коваль")).toHaveLength(1);
        expect(filterDropOff(rows, "ALPHA")).toHaveLength(1);
        expect(filterDropOff(rows, "")).toHaveLength(2);
    });

    it("labels a notification type with its settings title, else the code", () => {
        expect(notificationTypeLabel("participant.event.finished")).toBe("Захід завершено");
        expect(notificationTypeLabel("x.y")).toBe("x.y");
        expect(notificationTypeLabel("")).toBe("Без типу");
    });
});
