// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const manager = vi.hoisted(() => ({canManage: true}));
const router = vi.hoisted(() => ({replace: vi.fn()}));
vi.mock("next/navigation", () => ({useRouter: () => router}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {AttemptsManager} from "./AttemptsManager";

// jsdom has no modal dialogs.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const ids = {team: "0190c6a4-0000-7000-8000-000000000001", user: "0190c6a4-0000-7000-8000-000000000002", challenge: "0190c6a4-0000-7000-8000-000000000003"};
function attempt(n: number, extra: Record<string, unknown> = {}) {
    return {
        ID: `0190c6a4-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`, EventTeamID: ids.team, TeamName: "Blue", TeamChallengeID: ids.challenge, EventChallengeID: ids.challenge,
        ChallengeName: "Warmup", EventExerciseID: ids.challenge, UserID: ids.user, ParticipantName: "Olena", Answer: "flag{a}", ExpectedFlag: "flag{b}",
        AutomaticCorrect: false, Decision: "automatic", DecisionReason: null, DecidedBy: null, DecidedAt: null, Correct: false, ReceivedAt: "2026-09-29T07:30:00Z", Points: null, ...extra,
    };
}

type Integrity = {sensitive: boolean; flags?: unknown; flagsFail?: boolean};

function mockApi(page: unknown, hints: unknown[] = [], integrity: Integrity = {sensitive: false}) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/manage/analytics/access")) return new Response(JSON.stringify({Status: {Code: 0}, Data: {Sections: true, Sensitive: integrity.sensitive}}), {status: 200});
        if (url.endsWith("/manage/analytics/integrity/flags")) return integrity.flagsFail ? new Response("{}", {status: 500}) : new Response(JSON.stringify({Status: {Code: 0}, Data: integrity.flags ?? []}), {status: 200});
        const data = url.includes("/solution-attempts") ? page : url.includes("/hint-unlocks") ? hints : url.includes("/manage/results") ? {Teams: []} : url.includes("/participants") ? {Items: [], Total: 0} : [];
        return new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
    }) as typeof fetch;
    return calls;
}

function renderManager(view: "attempts" | "hints" = "attempts") {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><AttemptsManager initialView={view} /></QueryClientProvider>);
}

describe("Журнал спроб", () => {
    afterEach(() => { cleanup(); manager.canManage = true; router.replace.mockClear(); });

    it("keeps the table headers and footer with the empty state inside the body", async () => {
        mockApi({Items: [], Total: 0});
        renderManager();
        const table = screen.getByRole("table");
        expect(within(table).getByRole("columnheader", {name: "Бали"})).toBeTruthy();
        await waitFor(() => expect(within(table).getByText("Спроб поки немає.")).toBeTruthy());
        expect(within(table).getByText("Спроб поки немає.").closest("tbody")).toBeTruthy();
        expect(screen.getByText("Сторінка 1 з 1")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Зараховані"}).closest(".ib-seg")).toBeTruthy();
    });

    it("shows how many attempts the team used out of the allowed ones", async () => {
        mockApi({Items: [attempt(1, {AttemptsAllowed: 5, AttemptsUsed: 3}), attempt(2, {AttemptsAllowed: null, AttemptsUsed: 7})], Total: 2});
        renderManager();
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(3));
        expect(within(table).getByRole("columnheader", {name: "Спроби"})).toBeTruthy();
        const rows = within(table).getAllByRole("row");
        expect(within(rows[1]).getByText("3 з 5")).toBeTruthy();
        expect(within(rows[2]).getByText("Без ліміту")).toBeTruthy();
    });

    it("lists attempts with result, points and answers for managers", async () => {
        const calls = mockApi({Items: [attempt(1, {Correct: true, AutomaticCorrect: true, Points: 250}), attempt(2)], Total: 2});
        renderManager();
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(3));
        const rows = within(table).getAllByRole("row");
        expect(within(rows[0]).getByText("Відповідь")).toBeTruthy();
        expect(within(rows[1]).getByText("Зараховано")).toBeTruthy();
        expect(within(rows[1]).getByText("250")).toBeTruthy();
        expect(within(rows[1]).getByText("flag{a}")).toBeTruthy();
        expect(within(rows[2]).getByText("Не зараховано")).toBeTruthy();
        expect(within(rows[2]).getByText("—")).toBeTruthy();
        expect(calls.find(url => url.includes("/solution-attempts?"))).toContain("pageSize=25");
        fireEvent.click(screen.getByRole("button", {name: "Не зараховані"}));
        await waitFor(() => expect(calls.some(url => url.includes("correct=false"))).toBe(true));
        fireEvent.keyDown(rows[1], {key: "Enter"});
        expect(await screen.findByRole("button", {name: "Показати еталон"})).toBeTruthy();
    });

    it("hides the submitted value and export from viewers", async () => {
        manager.canManage = false;
        mockApi({Items: [attempt(1, {Answer: null, ExpectedFlag: null})], Total: 1});
        renderManager();
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(2));
        expect(within(table).queryByText("Відповідь")).toBeNull();
        expect(screen.queryByRole("button", {name: /Експорт CSV/})).toBeNull();
    });

    it("switches to the hints log and keeps its address", async () => {
        mockApi({Items: [], Total: 0}, [{TeamID: ids.team, TeamName: "Blue", EventChallengeID: ids.challenge, ChallengeName: "Warmup", HintID: ids.user, HintIndex: 0, UnlockedBy: ids.user, UnlockedByName: "Olena", UnlockedAt: "2026-09-29T07:30:00Z", Cost: 10}]);
        renderManager();
        fireEvent.click(screen.getByRole("button", {name: "Відкриті підказки"}));
        expect(router.replace).toHaveBeenCalledWith("/manage/submissions?tab=hints", {scroll: false});
        const table = screen.getByRole("table");
        expect(within(table).getByRole("columnheader", {name: "Вартість"})).toBeTruthy();
        expect(await within(table).findByText("Підказка 1")).toBeTruthy();
    });
});

describe("Журнал спроб: позначка доброчесності", () => {
    afterEach(() => { cleanup(); manager.canManage = true; });
    const flag = {TeamChallengeID: ids.challenge, TeamID: ids.team, ChallengeID: ids.challenge, Count: 2, Signals: ["too_fast", "burst"], CrossFlagTimes: ["2026-09-29T07:31:00.000Z"]};
    const page = {Items: [attempt(1, {Correct: true, AutomaticCorrect: true, Points: 100}), attempt(2, {EventChallengeID: "0190c6a4-0000-7000-8000-000000000009", TeamChallengeID: "0190c6a4-0000-7000-8000-00000000000a", Correct: true}), attempt(3)], Total: 3};
    const flagged = () => screen.queryAllByRole("link", {name: /Є підозрілі сигнали для цього розвʼязку/});

    it("marks a flagged correct attempt only, linking to the integrity page on that team and task", async () => {
        const calls = mockApi(page, [], {sensitive: true, flags: [flag]});
        renderManager();
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(4));
        await waitFor(() => expect(flagged()).toHaveLength(1));
        const icon = flagged()[0];
        expect(icon.getAttribute("aria-label")).toBe("Є підозрілі сигнали для цього розвʼязку: Розвʼязано швидше за поріг рівня складності; Кілька розвʼязань за дуже короткий час");
        const href = new URL(icon.getAttribute("href")!, "https://event.test");
        expect(href.pathname).toBe("/manage/analytics/integrity");
        expect(href.searchParams.get("teamId")).toBe(ids.team);
        expect(href.searchParams.get("challengeId")).toBe(ids.challenge);
        expect(icon.closest("tr")).toBe(within(table).getAllByRole("row")[1]);
        expect(calls.filter(url => url.endsWith("/integrity/flags"))).toHaveLength(1);
    });

    it("also marks the incorrect submission of another team's flag, with that reason only", async () => {
        const items = [attempt(1, {Correct: true, AutomaticCorrect: true}), attempt(2, {ReceivedAt: "2026-09-29T07:31:00Z"}), attempt(3)];
        mockApi({Items: items, Total: 3}, [], {sensitive: true, flags: [flag]});
        renderManager();
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(4));
        await waitFor(() => expect(flagged()).toHaveLength(2));
        const rows = within(table).getAllByRole("row");
        expect(within(rows[2]).getByRole("link").getAttribute("aria-label")).toBe("Є підозрілі сигнали для цього розвʼязку: Надіслано прапор іншої команди");
        expect(within(rows[3]).queryByRole("link")).toBeNull();
    });

    it("asks for nothing and shows nothing without the sensitive access", async () => {
        const calls = mockApi(page, [], {sensitive: false, flags: [flag]});
        renderManager();
        await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4));
        await waitFor(() => expect(calls.some(url => url.endsWith("/analytics/access"))).toBe(true));
        expect(calls.some(url => url.endsWith("/integrity/flags"))).toBe(false);
        expect(flagged()).toHaveLength(0);
    });

    it("stays silent when the flags call fails", async () => {
        const calls = mockApi(page, [], {sensitive: true, flagsFail: true});
        renderManager();
        await waitFor(() => expect(calls.some(url => url.endsWith("/integrity/flags"))).toBe(true));
        await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4));
        expect(flagged()).toHaveLength(0);
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
