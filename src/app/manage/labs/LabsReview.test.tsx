// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import ManageLabsPage from "./page";

const state = vi.hoisted(() => ({canManage: true, vpn: vi.fn()}));
const BLUE = "11111111-1111-4111-8111-111111111111";
const MODS = "33333333-3333-4333-8333-333333333333";
const stand = (TeamID: string, TeamName: string, Moderators = false) => ({TeamID, TeamName, Moderators, Status: "ready", Reason: "", UpdatedAt: null, Generation: 0, Labs: []});
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Tag: "e1"}, canManage: state.canManage})}));
vi.mock("@/components/event/manage/StandDetailDialog", () => ({StandDetailDialog: () => null}));
vi.mock("@/api/manageLabs", async original => ({
    ...await original() as object,
    getManageLabs: async () => ({
        InfrastructureAllowed: true, LaboratoriesAvailable: true, TeardownDelayMinutes: 30, DeployAt: null, TeardownAt: null, ChallengesOpened: true,
        Summary: {Total: 2, NotDeployed: 0, Creating: 0, Ready: 2, Failed: 0, Removed: 0}, Items: [stand(BLUE, "Blue Team"), stand(MODS, "", true)],
    }),
    getModeratorVPNConfig: (...args: unknown[]) => state.vpn(...args),
}));
beforeEach(() => {state.canManage = true; state.vpn.mockReset();});
afterEach(cleanup);

function renderPage() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageLabsPage /></QueryClientProvider>);
}

it("puts the moderators' stand in its own block above the teams table", async () => {
    renderPage();
    await screen.findByText("Blue Team");
    const block = screen.getByRole("region", {name: "Стенд модераторів"});
    expect(within(block).getByRole("button", {name: /VPN-конфіг/})).toBeTruthy();
    expect(within(block).getByRole("button", {name: /Завдання/})).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).queryByRole("button", {name: /VPN-конфіг/})).toBeNull();
    expect(within(table).queryByText("Команда модераторів")).toBeNull();
});

it("shows what the VPN button is doing while the config downloads", async () => {
    state.vpn.mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    await screen.findByText("Blue Team");
    const button = screen.getByRole("button", {name: /VPN-конфіг/});
    fireEvent.click(button);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    expect(button.textContent).toContain("Готуємо VPN-конфіг…");
});

it("lets a read-only viewer open a stand's details", async () => {
    state.canManage = false;
    renderPage();
    await screen.findByText("Blue Team");
    expect(screen.getAllByRole("button", {name: /Деталі/}).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", {name: /Перестворити/})).toBeNull();
    expect(screen.queryByRole("button", {name: /VPN-конфіг/})).toBeNull();
});
