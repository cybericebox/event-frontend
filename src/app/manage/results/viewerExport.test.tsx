// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {t} from "@/i18n/t";
import ManageResultsPage from "./page";

const role = vi.hoisted(() => ({canManage: false}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "event-1", Participation: 1, Name: "Захід"}, canManage: role.canManage})}));
vi.mock("@/utils/eventStream", () => ({useEventStream: () => "live"}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<object>(), getModeratorResults: async () => ({
    Revision: 1, GeneratedAt: new Date().toISOString(),
    Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
    Counts: {Ranked: 1, Hidden: 0, NotAdmitted: 0},
    Teams: [{Rank: 1, TeamID: "00000000-0000-4000-8000-000000000001", Name: "Альфа", RealName: "Альфа", Pseudonym: null, Individual: false, Hidden: false, Admitted: true,
        Points: 0, Solved: 0, LastSolveAt: null, Hints: 0, HintPoints: 0, Solves: []}],
})}));

afterEach(cleanup);

function page() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageResultsPage /></QueryClientProvider>);
    return screen.findByText("Альфа");
}

it("hides the results CSV from a viewer", async () => {
    role.canManage = false;
    await page();
    expect(screen.queryByRole("button", {name: new RegExp(t("manage.attempts.export"))})).toBeNull();
});

it("keeps the results CSV for a manager", async () => {
    role.canManage = true;
    await page();
    expect(screen.getByRole("button", {name: new RegExp(t("manage.attempts.export"))})).toBeTruthy();
});
