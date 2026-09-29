// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ManageTeam} from "@/api/manageTeams";
import ManageTeamsPage from "./page";

let form: ParticipantForm;
let teams: ManageTeam[];
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Participation: 1}, canManage: true})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("next/link", () => ({default: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => form, putManageTeamFields: vi.fn()}));
vi.mock("@/api/manageParticipants", async original => ({...(await original() as object), getManageParticipants: async () => ({Items: [], Total: 0})}));
vi.mock("@/api/manageListColumns", () => ({getManageListColumns: async () => ({List: "teams", Columns: []}), putManageListColumns: vi.fn()}));
vi.mock("@/api/manageStaffFields", () => ({
    getManageStaffFields: async () => ({Values: {note: "Потрібен стіл"}, Change: null}),
    putManageStaffFields: vi.fn(),
}));
vi.mock("@/api/manageTeams", async original => ({
    ...(await original() as object),
    getManageTeamsTable: async () => ({Items: teams, Total: teams.length, Page: 1, PageSize: 25}),
}));

const field = (key: string, label: string, extra: Partial<FormField> = {}): FormField => ({id: key, type: "field", key, input: "text", label, ...extra});
const team = (id: string, name: string, extra: Partial<ManageTeam> = {}): ManageTeam => ({
    ID: id, Name: name, CaptainID: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", Hidden: false, MemberCount: 2, ExtraFields: {}, FieldsMissing: 0, CreatedAt: "2026-09-01T10:00:00Z",
    Members: [], PendingInvitations: [], Admitted: true, AdmittedManually: false, MinTeamSize: 2, CaptainPending: false, ...extra,
});

beforeEach(() => {
    form = {Version: 3, Enabled: true, Required: true, Document: {blocks: [
        field("school", "Школа", {required: true}), field("note", "Нотатка організаторів", {input: "long_text", staffOnly: true}),
    ]}};
    teams = [team("11111111-1111-4111-8111-111111111111", "Blue Team", {FieldsMissing: 1, ExtraFields: {school: "KPI", note: "Потрібен стіл"}}), team("22222222-2222-4222-8222-222222222222", "Red Team", {ExtraFields: {school: "LNU"}})];
});
afterEach(cleanup);

function renderPage() {
    render(<QueryClientProvider client={new QueryClient()}><ManageTeamsPage /></QueryClientProvider>);
}

describe("required fields asked from every team (teams table)", () => {
    it("shows «Не заповнено» with the number for teams that owe fields", async () => {
        form = {...form, RequireExisting: true};
        renderPage();
        await screen.findByText("Blue Team");
        expect(screen.getAllByRole("columnheader").some(cell => cell.textContent?.includes("Не заповнено"))).toBe(true);
        expect(within(screen.getByText("Blue Team").closest("tr")!).getByText("1")).toBeTruthy();
    });

    it("has no such column while only new teams are asked", async () => {
        renderPage();
        await screen.findByText("Blue Team");
        expect(screen.getAllByRole("columnheader").some(cell => cell.textContent?.includes("Не заповнено"))).toBe(false);
    });
});

describe("staff-only fields (teams table)", () => {
    it("are editable in the team's «Керувати» dialog and stay out of the answers listing", async () => {
        renderPage();
        await screen.findByText("Blue Team");
        fireEvent.click(screen.getByRole("button", {name: "Керувати командою Blue Team"}));
        const dialog = await screen.findByRole("dialog");
        expect(await within(dialog).findByText("Службові поля")).toBeTruthy();
        expect(await within(dialog).findByDisplayValue("Потрібен стіл")).toBeTruthy();
        expect(within(dialog).getByText("Школа")).toBeTruthy();
        expect(within(dialog).getAllByText("Нотатка організаторів")).toHaveLength(1);
        await waitFor(() => expect(within(dialog).getByText("Службові поля ще не змінювали")).toBeTruthy());
    });
});
