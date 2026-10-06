// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
const download = vi.hoisted(() => vi.fn(async () => undefined));
const manager = vi.hoisted(() => ({canManage: true}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: manager.canManage})}));
vi.mock("echarts-for-react", () => ({default: ({option}: {option: {series: unknown[]}}) => <div data-testid="chart" data-series={option.series.length} />}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/csvDownload", async original => ({...(await original() as object), downloadManageFile: download}));

import {AnalyticsIntegrity} from "./AnalyticsIntegrity";
import {AnalyticsReport} from "./AnalyticsReport";
import {AnalyticsStands} from "./AnalyticsStands";

// jsdom has no modal dialogs.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

afterEach(cleanup);
beforeEach(() => {download.mockClear(); manager.canManage = true;});

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

const thresholds = {FloorSeconds: {elementary: 0, trivial: 5, easy: 20, medium: 60, hard: 120, insane: 240}, BruteForceAttempts: 15, BruteForceWindowSeconds: 60, FollowGapSeconds: 30};
const counts = {cross_flag: 1, no_access: 1, no_lab: 0, too_fast: 2, first_try_hard: 0, shared_wrong: 1, burst: 0, brute_force: 0, follows_solve: 0};
const tcBlue = "0190c6a4-0000-7000-8000-0000000000b1";
const tcRed = "0190c6a4-0000-7000-8000-0000000000b2";
const tcGreen = "0190c6a4-0000-7000-8000-0000000000b3";
const green = "0190c6a4-0000-7000-8000-000000000003";
const empty = {Count: 0, Extra: 0, Seconds: 0, Baseline: 0, Teams: [], Info: false, Answers: [], Owner: null, At: null};

function integrity(extra: Record<string, unknown> = {}) {
    return {
        Items: [
            {TeamChallengeID: tcGreen, TeamID: green, TeamName: "Green", ChallengeID: challenge, ChallengeName: "Web 1", Level: "easy", Solved: false, At: past, Review: null,
                Signals: [{...empty, Kind: "cross_flag", Count: 2, At: past, Owner: {TeamID: red, TeamName: "Red", ChallengeID: challenge, ChallengeName: "Web 1", SameTask: true}}]},
            {TeamChallengeID: tcBlue, TeamID: blue, TeamName: "Blue", ChallengeID: challenge, ChallengeName: "Web 1", Level: "easy", Solved: true, At: past, Review: null,
                Signals: [{...empty, Kind: "too_fast", Seconds: 3, Baseline: 20},
                    {...empty, Kind: "shared_wrong", Count: 2, Info: true, Teams: [{ID: red, Name: "Red"}], Answers: [{Value: "flag{shared}", Order: [{TeamID: red, TeamName: "Red", At: "2026-09-29T10:03:11.000Z"}, {TeamID: blue, TeamName: "Blue", At: "2026-09-29T10:04:00.000Z"}]}]}]},
            {TeamChallengeID: tcRed, TeamID: red, TeamName: "Red", ChallengeID: challenge, ChallengeName: "Web 1", Level: "elementary", Solved: true, At: past,
                Review: {Note: "Same room", ReviewedBy: "Olena", ReviewedAt: past}, Signals: [{...empty, Kind: "no_access"}]},
        ],
        Total: 3, Counts: counts, Thresholds: thresholds, Defaults: thresholds, Period: {From: past, To: past}, ...extra,
    };
}

const dismissal = {ID: "0190c6a4-0000-7000-8000-0000000000d1", Scope: "exercise", Kind: "shared_wrong", Key: "flag{shared}", Note: "Common path", ChallengeName: "Web 1", CreatedBy: "Olena", CreatedAt: past};

type Recorded = {url: string; method: string; body: string | null};

// Answers by path after /manage/; the review endpoint answers with `review`.
function mockIntegrity(options: {access?: unknown; data?: unknown; failList?: boolean; review?: {status: number; code?: number}; dismissals?: unknown[]; dismiss?: {status: number; code?: number}} = {}) {
    const calls: Recorded[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({url, method, body: typeof init?.body === "string" ? init.body : null});
        const path = url.split("/manage/")[1]?.split("?")[0] ?? "";
        const ok = (data: unknown) => new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
        if (path === "analytics/access") return ok(options.access ?? {Sections: true, Sensitive: true});
        if (path === "analytics/integrity") return options.failList ? new Response("{}", {status: 500}) : ok(options.data ?? integrity());
        if (path === "analytics/integrity/dismissals" && method === "GET") return ok(options.dismissals ?? []);
        if (path.startsWith("analytics/integrity/dismissals")) {
            const result = options.dismiss ?? {status: 200};
            return new Response(JSON.stringify({Status: {Code: result.status === 200 ? 0 : result.code ?? 0}}), {status: result.status});
        }
        if (path.startsWith("analytics/integrity/solves/")) {
            const review = options.review ?? {status: 200};
            return new Response(review.status === 200 ? JSON.stringify({Status: {Code: 0}}) : JSON.stringify({Status: {Code: review.code ?? 0}}), {status: review.status});
        }
        return new Response("{}", {status: 404});
    }) as typeof fetch;
    return calls;
}

const listCalls = (calls: Recorded[]) => calls.filter(call => call.method === "GET" && /\/analytics\/integrity(\?|$)/.test(call.url));
const lastList = (calls: Recorded[]) => new URL(listCalls(calls).at(-1)!.url).searchParams;

describe("Доброчесність", () => {
    it("is closed to viewers without the sensitive level and asks for nothing", async () => {
        const calls = mockIntegrity({access: {Sections: true, Sensitive: false}});
        renderWith(<AnalyticsIntegrity />);
        expect(await screen.findByText(/Ці дані бачать лише власник заходу/)).toBeTruthy();
        expect(calls.some(call => call.url.includes("/analytics/integrity"))).toBe(false);
    });

    it("lists flagged solves with team, task, level and signals, unreviewed by default", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        const rows = within(table).getAllByRole("row");
        expect(within(rows[1]).getByText("Green")).toBeTruthy();
        expect(within(rows[1]).getByText("Прапор іншої команди").className).toContain("ib-tag--danger");
        expect(within(rows[1]).getByText("Не розвʼязано")).toBeTruthy();
        const blueRow = within(table).getByText("Blue").closest("tr")!;
        expect(within(blueRow).getByText("Web 1")).toBeTruthy();
        expect(within(blueRow).getByText("Спільні помилки (інформаційно)")).toBeTruthy();
        expect(within(blueRow).getByText("Легке")).toBeTruthy();
        expect(within(blueRow).getByText("Надто швидко")).toBeTruthy();
        const redRow = within(table).getByText("Red").closest("tr")!;
        expect(within(redRow).getByText("Елементарне")).toBeTruthy();
        expect(within(redRow).getByText("Перевірено")).toBeTruthy();
        expect(lastList(calls).get("reviewed")).toBe("no");
        expect(screen.getByText(/а не вердикти/)).toBeTruthy();
        const journal = new URL(within(blueRow).getByRole("link", {name: "Журнал спроб"}).getAttribute("href")!, "https://event.test").searchParams;
        expect(journal.get("teamId")).toBe(blue);
        expect(journal.get("challengeId")).toBe(challenge);
    });

    it("shows the evidence of every signal, and the review, when a row is expanded", async () => {
        mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        expect(within(table).queryByText(/Здано через 3 с/)).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Докази: Blue, Web 1"}));
        expect(within(table).getByText("Здано через 3 с після першого відкриття завдання (поріг для рівня «Легке» — 20 с).")).toBeTruthy();
        expect(within(table).getByText("Неправильні відповіді цієї команди збігаються з відповідями інших команд: 2.")).toBeTruthy();
        expect(within(table).getByText("flag{shared}")).toBeTruthy();
        expect(within(table).getByText(/^1\. Red — /)).toBeTruthy();
        expect(within(table).getByText(/^2\. Blue — /)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Докази: Green, Web 1"}));
        expect(within(table).getByText(/Надіслала прапор іншої команди «Red» того самого завдання; разів: 2, востаннє /)).toBeTruthy();
        expect(within(table).getAllByRole("button", {name: "Не підсвічувати такі випадки"})).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", {name: "Докази: Red, Web 1"}));
        expect(within(table).getByText("Same room")).toBeTruthy();
        expect(within(table).getByText(/Olena, /)).toBeTruthy();
    });

    it("shows the counts on the signal chips and toggles the signal filter", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        await screen.findByRole("table");
        const group = screen.getByRole("group", {name: "Тип сигналу"});
        expect(within(group).getAllByRole("button")[0].textContent).toContain("Прапор іншої команди");
        const fast = within(group).getByRole("button", {name: /Надто швидко/});
        expect(fast.textContent).toContain("2");
        expect(fast.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(fast);
        await waitFor(() => expect(lastList(calls).get("signal")).toBe("too_fast"));
        expect(within(group).getByRole("button", {name: /Надто швидко/}).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(within(group).getByRole("button", {name: /Надто швидко/}));
        await waitFor(() => expect(lastList(calls).get("signal")).toBeNull());
    });

    it("filters by the review state", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: "Перевірені"}));
        await waitFor(() => expect(lastList(calls).get("reviewed")).toBe("yes"));
        fireEvent.click(screen.getByRole("button", {name: "Усі"}));
        await waitFor(() => expect(lastList(calls).has("reviewed")).toBe(false));
    });

    it("presets the team and task from the link and sends them", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity initialFilters={{teamId: blue, challengeId: challenge}} />);
        await screen.findByRole("table");
        expect(lastList(calls).get("teamId")).toBe(blue);
        expect(lastList(calls).get("challengeId")).toBe(challenge);
    });

    it("sends the applied thresholds and resets them to the defaults", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: /Пороги/}));
        fireEvent.change(screen.getByLabelText("Середнє"), {target: {value: "90"}});
        fireEvent.click(screen.getByRole("button", {name: "Застосувати"}));
        await waitFor(() => expect(lastList(calls).get("floorMedium")).toBe("90"));
        expect(lastList(calls).get("floorElementary")).toBe("0");
        expect(lastList(calls).get("followGap")).toBe("30");
        fireEvent.click(screen.getByRole("button", {name: "Скинути до типових"}));
        await waitFor(() => expect(lastList(calls).has("floorMedium")).toBe(false));
    });

    it("shows the event loader while the list loads", async () => {
        mockIntegrity();
        const answer = globalThis.fetch;
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith("/analytics/integrity?reviewed=no") ? new Promise<Response>(() => undefined) : answer(input, init)) as typeof fetch;
        renderWith(<AnalyticsIntegrity />);
        expect(await screen.findByRole("status", {name: "Завантажуємо розвʼязки"})).toBeTruthy();
        expect(screen.queryByRole("table")).toBeNull();
    });

    it("dismisses a shared wrong answer for the event with a note", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: "Докази: Blue, Web 1"}));
        fireEvent.click(within(table).getByRole("button", {name: "Допустима відповідь"}));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("flag{shared}")).toBeTruthy();
        expect(within(dialog).getByRole("radio", {name: /Лише цей захід/})).toHaveProperty("checked", true);
        expect(within(dialog).getByText("Торкнеться кожного заходу, де використовується це завдання каталогу.")).toBeTruthy();
        fireEvent.change(within(dialog).getByLabelText("Нотатка"), {target: {value: "Common path"}});
        const before = listCalls(calls).length;
        fireEvent.click(within(dialog).getByRole("button", {name: "Виключити"}));
        await waitFor(() => expect(calls.some(call => call.method === "POST")).toBe(true));
        const post = calls.find(call => call.method === "POST")!;
        expect(post.url).toContain("/analytics/integrity/dismissals");
        expect(JSON.parse(post.body!)).toEqual({TeamChallengeID: tcBlue, Kind: "shared_wrong", Key: "flag{shared}", Scope: "event", Note: "Common path"});
        await waitFor(() => expect(listCalls(calls).length).toBeGreaterThan(before));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });

    it("dismisses another kind for the whole catalog exercise, offered to every viewer of the page", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: "Докази: Red, Web 1"}));
        fireEvent.click(within(table).getByRole("button", {name: "Не підсвічувати такі випадки"}));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("radio", {name: /Усі заходи з цим завданням каталогу/}));
        fireEvent.click(within(dialog).getByRole("button", {name: "Виключити"}));
        await waitFor(() => expect(calls.some(call => call.method === "POST")).toBe(true));
        expect(JSON.parse(calls.find(call => call.method === "POST")!.body!)).toMatchObject({TeamChallengeID: tcRed, Kind: "no_access", Key: "", Scope: "exercise"});
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });

    it("keeps the dialog open with the message when the pattern cannot be dismissed", async () => {
        mockIntegrity({dismiss: {status: 400, code: 22207}});
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: "Докази: Red, Web 1"}));
        fireEvent.click(within(table).getByRole("button", {name: "Не підсвічувати такі випадки"}));
        fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", {name: "Виключити"}));
        expect(await screen.findByText("Такий випадок не можна виключити з підсвічування")).toBeTruthy();
        expect(screen.getByRole("alertdialog")).toBeTruthy();
    });

    it("offers no dismissal for a cross_flag or a burst", async () => {
        mockIntegrity({data: integrity({Items: [integrity().Items[0]], Total: 1})});
        renderWith(<AnalyticsIntegrity />);
        await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: "Докази: Green, Web 1"}));
        expect(screen.queryByRole("button", {name: "Не підсвічувати такі випадки"})).toBeNull();
    });

    it("is read-only for a viewer: no review, no dismissal, no removal", async () => {
        manager.canManage = false;
        mockIntegrity({dismissals: [dismissal]});
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        expect(screen.queryByRole("button", {name: "Позначити як перевірене"})).toBeNull();
        expect(screen.queryByRole("button", {name: "Зняти позначку"})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Докази: Blue, Web 1"}));
        expect(within(table).getByText("flag{shared}")).toBeTruthy();
        expect(within(table).queryByRole("button", {name: "Допустима відповідь"})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Докази: Red, Web 1"}));
        expect(within(table).queryByRole("button", {name: "Не підсвічувати такі випадки"})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Виключення"}));
        const row = (await screen.findByText("Common path")).closest("tr")!;
        expect(within(row).queryByRole("button", {name: "Прибрати"})).toBeNull();
    });

    it("lists the dismissals and removes one after a confirmation", async () => {
        const calls = mockIntegrity({dismissals: [dismissal]});
        renderWith(<AnalyticsIntegrity />);
        await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: "Виключення"}));
        const row = (await screen.findByText("Common path")).closest("tr")!;
        expect(within(row).getByText("Спільні помилки")).toBeTruthy();
        expect(within(row).getByText("flag{shared}")).toBeTruthy();
        expect(within(row).getByText("Усі заходи з цим завданням каталогу")).toBeTruthy();
        expect(within(row).getByText("Olena")).toBeTruthy();
        fireEvent.click(within(row).getByRole("button", {name: "Прибрати"}));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByRole("button", {name: "Прибрати"}).className).toContain("ib-btn--danger");
        fireEvent.click(within(dialog).getByRole("button", {name: "Прибрати"}));
        await waitFor(() => expect(calls.some(call => call.method === "DELETE" && call.url.endsWith(`/dismissals/${dismissal.ID}`))).toBe(true));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });

    it("says so when there are no dismissals", async () => {
        mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", {name: "Виключення"}));
        expect(await screen.findByText("Виключень немає")).toBeTruthy();
    });

    it("says so, inside the block, when nothing is flagged", async () => {
        mockIntegrity({data: integrity({Items: [], Total: 0})});
        renderWith(<AnalyticsIntegrity />);
        expect(await screen.findByText("Розвʼязків для перевірки немає")).toBeTruthy();
        expect(screen.getByRole("table")).toBeTruthy();
    });

    it("shows the load error with a retry", async () => {
        mockIntegrity({failList: true});
        renderWith(<AnalyticsIntegrity />);
        expect(await screen.findByText("Не вдалося завантажити розвʼязки для перевірки")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    });

    it("marks a solve as reviewed with a note, then refetches", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        fireEvent.click(within(within(table).getByText("Blue").closest("tr")!).getByRole("button", {name: "Позначити як перевірене"}));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.change(within(dialog).getByLabelText("Нотатка"), {target: {value: "  Checked the logs  "}});
        expect(within(dialog).getByText("20 / 1000")).toBeTruthy();
        const before = listCalls(calls).length;
        fireEvent.click(within(dialog).getByRole("button", {name: "Позначити"}));
        await waitFor(() => expect(calls.some(call => call.method === "PUT")).toBe(true));
        const put = calls.find(call => call.method === "PUT")!;
        expect(put.url).toContain(`/analytics/integrity/solves/${tcBlue}/review`);
        expect(JSON.parse(put.body!)).toEqual({Note: "Checked the logs"});
        await waitFor(() => expect(listCalls(calls).length).toBeGreaterThan(before));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });

    it("keeps the dialog open with the server's message when the review fails", async () => {
        mockIntegrity({review: {status: 404, code: 32205}});
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        fireEvent.click(within(within(table).getByText("Blue").closest("tr")!).getByRole("button", {name: "Позначити як перевірене"}));
        fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", {name: "Позначити"}));
        expect(await screen.findByText("Розвʼязок не знайдено в цьому заході")).toBeTruthy();
        expect(screen.getByRole("alertdialog")).toBeTruthy();
    });

    it("falls back to a generic message for an unknown failure", async () => {
        mockIntegrity({review: {status: 500}});
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        fireEvent.click(within(within(table).getByText("Blue").closest("tr")!).getByRole("button", {name: "Позначити як перевірене"}));
        fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", {name: "Позначити"}));
        expect(await screen.findByText("Не вдалося зберегти позначку")).toBeTruthy();
    });

    it("removes the review mark after a confirmation", async () => {
        const calls = mockIntegrity();
        renderWith(<AnalyticsIntegrity />);
        const table = await screen.findByRole("table");
        fireEvent.click(within(within(table).getByText("Red").closest("tr")!).getByRole("button", {name: "Зняти позначку"}));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).queryByLabelText("Нотатка")).toBeNull();
        fireEvent.click(within(dialog).getByRole("button", {name: "Зняти позначку"}));
        await waitFor(() => expect(calls.some(call => call.method === "DELETE" && call.url.includes(`/solves/${tcRed}/review`))).toBe(true));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
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
