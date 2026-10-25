// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ManageTeam} from "@/api/manageTeams";
import ManageTeamsPage from "./page";

const state = vi.hoisted(() => ({canManage: true, formAll: vi.fn()}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Participation: 1}, canManage: state.canManage})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("next/link", () => ({default: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => ({Version: 1, Enabled: false, Required: false, Document: {blocks: []}}), putManageTeamFields: vi.fn()}));
vi.mock("@/api/manageParticipants", async original => ({...await original() as object, getManageParticipants: async () => ({Items: [], Total: 0})}));
vi.mock("@/api/manageListColumns", () => ({getManageListColumns: async () => ({List: "teams", Columns: []}), putManageListColumns: vi.fn()}));
vi.mock("@/api/moderatorsBoard", () => ({getModeratorsTeam: async () => {throw new Error("forbidden");}}));
const team: ManageTeam = {
    ID: "11111111-1111-4111-8111-111111111111", Name: "Blue Team", CaptainID: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", Hidden: false, MemberCount: 2, ExtraFields: {}, FieldsMissing: 0, CreatedAt: "2026-09-01T10:00:00Z",
    Members: [], PendingInvitations: [], Admitted: true, AdmittedManually: false, MinTeamSize: 2, CaptainPending: false,
} as ManageTeam;
vi.mock("@/api/manageTeams", async original => ({
    ...await original() as object,
    getManageTeamsTable: async () => ({Items: [team], Total: 1, Page: 1, PageSize: 25}),
    formAllManageTeams: state.formAll,
}));

beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {this.open = true;};
    HTMLDialogElement.prototype.close = function () {this.open = false;};
    state.canManage = true;
    state.formAll.mockReset();
});
afterEach(cleanup);

function renderPage() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageTeamsPage /></QueryClientProvider>);
}

it("forms every team after a confirmation", async () => {
    state.formAll.mockResolvedValue(15);
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name: "Сформувати всі команди"}));
    expect(await screen.findByText("Сформувати всі команди?")).toBeTruthy();
    expect(state.formAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Сформувати всі"}));
    await waitFor(() => expect(state.formAll).toHaveBeenCalledWith("e1"));
    await waitFor(() => expect(screen.queryByText("Сформувати всі команди?")).toBeNull());
});

it("keeps the dialog open with the error when forming fails", async () => {
    state.formAll.mockRejectedValue(new Error("boom"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name: "Сформувати всі команди"}));
    fireEvent.click(await screen.findByRole("button", {name: "Сформувати всі"}));
    expect(await screen.findByText("Не вдалося сформувати команди.")).toBeTruthy();
    expect(screen.getByText("Сформувати всі команди?")).toBeTruthy();
});

it("hides the action from a read-only viewer", async () => {
    state.canManage = false;
    renderPage();
    expect(await screen.findByRole("button", {name: "Переглянути команду Blue Team"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Сформувати всі команди"})).toBeNull();
});
