// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ManageTeam} from "@/api/manageTeams";
import ManageTeamsPage from "./page";

let teams: ManageTeam[];
let moderators: unknown;
const setHidden = vi.fn();
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Participation: 1}, canManage: true})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("next/link", () => ({default: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => ({Version: 1, Enabled: false, Required: false, Document: {blocks: []}}), putManageTeamFields: vi.fn()}));
vi.mock("@/api/manageParticipants", async original => ({...await original() as object, getManageParticipants: async () => ({Items: [], Total: 0})}));
vi.mock("@/api/manageListColumns", () => ({getManageListColumns: async () => ({List: "teams", Columns: []}), putManageListColumns: vi.fn()}));
vi.mock("@/api/moderatorsBoard", () => ({getModeratorsTeam: async () => { if (!moderators) throw new Error("forbidden"); return moderators; }}));
vi.mock("@/api/manageTeams", async original => ({
    ...await original() as object,
    getManageTeamsTable: async () => ({Items: teams, Total: teams.length, Page: 1, PageSize: 25}),
    setManageTeamHidden: (...args: unknown[]) => setHidden(...args),
}));

const team = (id: string, name: string, extra: Partial<ManageTeam> = {}): ManageTeam => ({
    ID: id, Name: name, CaptainID: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", Hidden: false, MemberCount: 2, ExtraFields: {}, FieldsMissing: 0, CreatedAt: "2026-09-01T10:00:00Z",
    Members: [], PendingInvitations: [], Admitted: true, AdmittedManually: false, MinTeamSize: 2, CaptainPending: false, ...extra,
});
const BLUE = "11111111-1111-4111-8111-111111111111";
const RED = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
    teams = [team(BLUE, "Blue Team"), team(RED, "Red Team", {Hidden: true})];
    moderators = {TeamID: "33333333-3333-4333-8333-333333333333", Members: [{UserID: "44444444-4444-4444-8444-444444444444", Name: "Богдан", Role: 0}, {UserID: "55555555-5555-4555-8555-555555555555", Name: "Ірина", Role: 1}]};
    setHidden.mockReset();
});
afterEach(cleanup);

function renderPage() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageTeamsPage /></QueryClientProvider>);
}

describe("hidden teams (teams table)", () => {
    it("marks hidden teams with the hidden icon and its explanation", async () => {
        renderPage();
        await screen.findByText("Red Team");
        const red = screen.getByText("Red Team").closest("tr")!;
        expect(within(red).getByRole("img", {name: "Прихована"})).toBeTruthy();
        expect(within(red).getByText(/не в рейтингу/)).toBeTruthy();
        expect(within(screen.getByText("Blue Team").closest("tr")!).queryByRole("img", {name: "Прихована"})).toBeNull();
    });

    it("shows the moderators team as one locked row on top without actions", async () => {
        renderPage();
        const row = (await screen.findByText("Команда модераторів")).closest("tr")!;
        expect(row.parentElement!.firstElementChild).toBe(row);
        expect(within(row).getByRole("img", {name: "Прихована"})).toBeTruthy();
        expect(within(row).getByText("2")).toBeTruthy();
        expect(within(row).queryAllByRole("button")).toHaveLength(0);
        expect(row.className).not.toContain("is-clickable");
    });

    it("hides the row when the moderators team cannot be read", async () => {
        moderators = null;
        renderPage();
        await screen.findByText("Blue Team");
        expect(screen.queryByText("Команда модераторів")).toBeNull();
    });

    it("toggles the hidden flag from the row: hide a visible team, show a hidden one", async () => {
        setHidden.mockResolvedValue({});
        renderPage();
        await screen.findByText("Blue Team");
        fireEvent.click(screen.getByRole("button", {name: "Приховати команду Blue Team"}));
        await waitFor(() => expect(setHidden).toHaveBeenCalledWith("e1", BLUE, true));
        fireEvent.click(screen.getByRole("button", {name: "Показати команду Red Team"}));
        await waitFor(() => expect(setHidden).toHaveBeenCalledWith("e1", RED, false));
    });

    it("locks only the team being saved while its hide request is pending", async () => {
        setHidden.mockReturnValueOnce(new Promise(() => {}));
        renderPage();
        await screen.findByText("Blue Team");
        fireEvent.click(screen.getByRole("button", {name: "Приховати команду Blue Team"}));
        await waitFor(() => expect(setHidden).toHaveBeenCalledWith("e1", BLUE, true));
        expect((screen.getByRole("button", {name: "Приховати команду Blue Team"}) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", {name: "Показати команду Red Team"}) as HTMLButtonElement).disabled).toBe(false);
    });
});
