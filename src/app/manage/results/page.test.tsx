// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import ManageResultsPage from "./page";

const now = new Date().toISOString();
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "event-1", Participation: 1, Name: "Захід"}, canManage: true})}));
vi.mock("@/utils/eventStream", () => ({useEventStream: () => "live"}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<object>(), getModeratorResults: async () => ({
    Revision: 3, GeneratedAt: now,
    Freeze: {Enabled: true, FrozenAt: now, FinishAt: new Date(Date.now() + 3_600_000).toISOString(), OpenedAt: null, Active: true, Applied: false},
    Counts: {Ranked: 1, Hidden: 0, NotAdmitted: 0},
    Teams: [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", Name: "Альфа", RealName: "Альфа", Pseudonym: null, Individual: false, Hidden: false, Admitted: true,
        Points: 300, Solved: 1, LastSolveAt: now, Hints: 1, HintPoints: 20,
        Solves: [{ChallengeID: "00000000-0000-4000-8000-000000000002", ChallengeName: "Web 1", Points: 300, SolvedAt: now, FirstBlood: true}]}],
})}));

afterEach(cleanup);

it("lists teams, marks the freeze for participants and expands the solves", async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><ManageResultsPage /></QueryClientProvider>);
    expect(await screen.findByText("Альфа")).toBeTruthy();
    expect(screen.getByText("Заморожено для учасників.")).toBeTruthy();
    expect(screen.getByRole("link", {name: "Відкрити Live"}).getAttribute("href")).toBe("/live");
    expect(screen.getByRole("columnheader", {name: /Підказки/})).toBeTruthy();
    const toggle = screen.getByRole("button", {name: "Показати розвʼязання: Альфа"});
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Web 1")).toBeTruthy();
    expect(screen.getByText("Криголам", {selector: ".ib-tag"})).toBeTruthy();
});
