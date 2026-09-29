// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const manager = vi.hoisted(() => ({canManage: true}));
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

function mockApi(page: unknown) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const data = url.includes("/solution-attempts") ? page : url.includes("/manage/results") ? {Teams: []} : url.includes("/participants") ? {Items: [], Total: 0} : [];
        return new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
    }) as typeof fetch;
    return calls;
}

function renderManager() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><AttemptsManager /></QueryClientProvider>);
}

describe("AttemptsManager", () => {
    afterEach(() => { cleanup(); manager.canManage = true; });

    it("shows the empty state centered in the table block", async () => {
        mockApi({Items: [], Total: 0});
        renderManager();
        const block = screen.getByRole("region", {name: "Спроби розв’язання"});
        await waitFor(() => expect(within(block).getByText("Спроб поки немає.")).toBeTruthy());
        expect(block.querySelector(".event-data-table__scroll [data-empty-state]")).not.toBeNull();
        expect(within(block).getByText("Сторінка 1 з 1")).toBeTruthy();
    });

    it("lists attempts with result, points and answers for managers", async () => {
        const calls = mockApi({Items: [attempt(1, {Correct: true, AutomaticCorrect: true, Points: 250}), attempt(2)], Total: 2});
        renderManager();
        const table = await screen.findByRole("table", {name: "Спроби розв’язання"});
        const rows = within(table).getAllByRole("row");
        expect(rows).toHaveLength(3);
        expect(within(rows[0]).getByText("Відповідь")).toBeTruthy();
        expect(within(rows[1]).getByText("Зараховано")).toBeTruthy();
        expect(within(rows[1]).getByText("250")).toBeTruthy();
        expect(within(rows[1]).getByText("flag{a}")).toBeTruthy();
        expect(within(rows[2]).getByText("Не зараховано")).toBeTruthy();
        expect(within(rows[2]).getByText("—")).toBeTruthy();
        expect(calls.find(url => url.includes("/solution-attempts?"))).toContain("pageSize=25");
        fireEvent.keyDown(rows[1], {key: "Enter"});
        expect(await screen.findByRole("button", {name: "Показати еталон"})).toBeTruthy();
    });

    it("hides the submitted value from viewers", async () => {
        manager.canManage = false;
        mockApi({Items: [attempt(1, {Answer: null, ExpectedFlag: null})], Total: 1});
        renderManager();
        const table = await screen.findByRole("table", {name: "Спроби розв’язання"});
        expect(within(table).queryByText("Відповідь")).toBeNull();
        expect(screen.queryByRole("button", {name: /Експорт CSV/})).toBeNull();
    });
});
