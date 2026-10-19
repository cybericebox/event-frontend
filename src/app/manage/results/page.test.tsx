// @vitest-environment jsdom
import {afterEach, beforeAll, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ModeratorResults} from "@/api/manageResults";
import ManageResultsPage from "./page";

const now = new Date().toISOString();
const hour = 3_600_000;
const api = vi.hoisted(() => ({results: null as unknown, setOpened: vi.fn()}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "event-1", Participation: 1, Name: "Захід"}, canManage: true})}));
vi.mock("@/utils/eventStream", () => ({useEventStream: () => "live"}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<object>(),
    getModeratorResults: async () => api.results,
    setResultsOpened: (...args: unknown[]) => api.setOpened(...args),
}));

const frozenNow: ModeratorResults["Freeze"] = {Enabled: true, FrozenAt: now, FinishAt: new Date(Date.now() + hour).toISOString(), OpenedAt: null, Active: true, Applied: false};
function results(extra: Partial<ModeratorResults> = {}): ModeratorResults {
    return {
        Revision: 3, GeneratedAt: now, ParticipantsSee: true, Freeze: frozenNow,
        Counts: {Ranked: 1, Hidden: 0, NotAdmitted: 0},
        Teams: [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", Name: "Альфа", RealName: "Альфа", Pseudonym: null, Individual: false, Hidden: false, Moderators: false, Admitted: true,
            Points: 300, Solved: 1, LastSolveAt: now, Hints: 1, HintPoints: 20,
            Solves: [{ChallengeID: "00000000-0000-4000-8000-000000000002", ChallengeName: "Web 1", Points: 300, SolvedAt: now, FirstBlood: true}]}],
        ...extra,
    };
}

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); api.setOpened.mockReset();});

function renderPage(data: ModeratorResults) {
    api.results = data;
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ManageResultsPage /></QueryClientProvider>);
}

it("lists teams, marks the freeze for participants and expands the solves", async () => {
    renderPage(results());
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByText("Заморожено для учасників.")).toBeTruthy();
    expect(screen.getByRole("link", {name: "Відкрити результати наживо"}).getAttribute("href")).toBe("/live");
    expect(screen.getByRole("columnheader", {name: /Підказки/})).toBeTruthy();
    const toggle = screen.getByRole("button", {name: "Показати розвʼязання: Альфа"});
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Web 1")).toBeTruthy();
    expect(screen.getByText("Криголам", {selector: ".ib-tag"})).toBeTruthy();
});

it("shows no participants-view banner while participants do not see the results", async () => {
    renderPage(results({ParticipantsSee: false}));
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.queryByRole("status", {name: "Заморожування рейтингу"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Відкрити підсумки"})).toBeNull();
});

it("offers «Відкрити підсумки» only during the freeze, not before it starts", async () => {
    const later = new Date(Date.now() + hour).toISOString();
    renderPage(results({Freeze: {...frozenNow, FrozenAt: later, FinishAt: new Date(Date.now() + 2 * hour).toISOString(), Active: false}}));
    expect(await screen.findByText("Учасники бачать актуальні дані.")).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Відкрити підсумки"})).toBeNull();
});

it("opens the results only after the confirmation", async () => {
    api.setOpened.mockResolvedValue(undefined);
    renderPage(results());
    fireEvent.click(await screen.findByRole("button", {name: "Відкрити підсумки"}));
    expect(screen.getByText("Відкрити підсумки?")).toBeTruthy();
    expect(api.setOpened).not.toHaveBeenCalled();
    await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Відкрити"}));});
    expect(api.setOpened).toHaveBeenCalledWith("event-1", true);
});

it("names the freeze date when it is not today", async () => {
    const tomorrow = new Date(Date.now() + 26 * hour);
    renderPage(results({Freeze: {...frozenNow, FrozenAt: tomorrow.toISOString(), FinishAt: new Date(tomorrow.getTime() + hour).toISOString(), Active: false}}));
    const date = new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long"}).format(tomorrow);
    expect(await screen.findByText(new RegExp(`Заморожування почнеться ${date} о`))).toBeTruthy();
});
