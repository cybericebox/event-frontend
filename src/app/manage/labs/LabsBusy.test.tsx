// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import ManageLabsPage from "./page";

const vpn = vi.fn();
const BLUE = "11111111-1111-4111-8111-111111111111";
const MODS = "33333333-3333-4333-8333-333333333333";
const stand = (TeamID: string, TeamName: string, Moderators = false) => ({TeamID, TeamName, Moderators, Status: "ready", Reason: "", UpdatedAt: null, Generation: 0, Labs: []});
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Tag: "e1"}, canManage: true})}));
vi.mock("@/api/manageLabs", async original => ({
    ...await original() as object,
    getManageLabs: async () => ({
        InfrastructureAllowed: true, LaboratoriesAvailable: true, DeployLeadMinutes: 30, TeardownDelayMinutes: 30, DeployAt: null, TeardownAt: null, ChallengesOpened: true,
        Summary: {Total: 2, NotDeployed: 0, Creating: 0, Ready: 2, Failed: 0, Removed: 0}, Items: [stand(BLUE, "Blue Team"), stand(MODS, "Moderators", true)],
    }),
    getModeratorVPNConfig: (...args: unknown[]) => vpn(...args),
}));
afterEach(cleanup);

describe("labs page busy flags", () => {
    it("keeps the recreate button enabled while the VPN config downloads", async () => {
        vpn.mockReturnValueOnce(new Promise(() => {}));
        render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageLabsPage /></QueryClientProvider>);
        await screen.findByText("Blue Team");
        const recreate = screen.getAllByRole("button", {name: /Перестворити/});
        const vpnButton = screen.getByRole("button", {name: /VPN/});
        fireEvent.click(vpnButton);
        await waitFor(() => expect(vpn).toHaveBeenCalled());
        expect((vpnButton as HTMLButtonElement).disabled).toBe(true);
        recreate.forEach(button => expect((button as HTMLButtonElement).disabled).toBe(false));
    });
});
