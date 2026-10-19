// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ManageTeam} from "@/api/manageTeams";
import ManageTeamsPage from "./page";

const state = vi.hoisted(() => ({canManage: true}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Participation: 1}, canManage: state.canManage})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("next/link", () => ({default: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => ({Version: 1, Enabled: false, Required: false, Document: {blocks: []}}), putManageTeamFields: vi.fn()}));
vi.mock("@/api/manageParticipants", async original => ({...await original() as object, getManageParticipants: async () => ({Items: [], Total: 0})}));
vi.mock("@/api/manageListColumns", () => ({getManageListColumns: async () => ({List: "teams", Columns: []}), putManageListColumns: vi.fn()}));
vi.mock("@/api/moderatorsBoard", () => ({getModeratorsTeam: async () => {throw new Error("forbidden");}}));
const BLUE = "11111111-1111-4111-8111-111111111111";
const team: ManageTeam = {
    ID: BLUE, Name: "Blue Team", CaptainID: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", Hidden: false, MemberCount: 2, ExtraFields: {}, FieldsMissing: 0, CreatedAt: "2026-09-01T10:00:00Z",
    Members: [], PendingInvitations: [], Admitted: true, AdmittedManually: false, MinTeamSize: 2, CaptainPending: false,
} as ManageTeam;
vi.mock("@/api/manageTeams", async original => ({
    ...await original() as object,
    getManageTeamsTable: async () => ({Items: [team], Total: 1, Page: 1, PageSize: 25}),
    getManageTeamProfile: async () => ({Results: {Rank: 1, Points: 100, Solved: 1, Hints: 0, HintPoints: 0, Solves: []}}),
}));

beforeEach(() => {state.canManage = true;});
afterEach(cleanup);

function renderPage() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageTeamsPage /></QueryClientProvider>);
}

it("shows «—» for hints when the team used none, like the results table", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name: "Керувати командою Blue Team"}));
    const hints = (await screen.findByText("Підказки", {selector: "dt"})).parentElement!;
    expect(within(hints).getByText("—")).toBeTruthy();
    expect(hints.textContent).not.toContain("−0");
});

it("names the row button «Переглянути» for a read-only viewer", async () => {
    state.canManage = false;
    renderPage();
    expect(await screen.findByRole("button", {name: "Переглянути команду Blue Team"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Керувати командою Blue Team"})).toBeNull();
});
