// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- Tests native anchor interception. */
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ManualDraftProvider} from "./manualDraft";
import ParticipationSettingsPage from "@/app/manage/participation-settings/page";
import {t} from "@/i18n/t";

const server = vi.hoisted(() => ({config: {Participation: 0, Registration: 0, MaxTeamSize: 3, MinTeamSize: null}, save: vi.fn(), pending: false, push: vi.fn()}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/participation-settings", useRouter: () => ({push: server.push, replace: vi.fn()})}));
vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: "event-a", Name: "Event", LogoURL: ""}, canManage: true})}));
vi.mock("@/api/manage", async original => ({...(await original() as object), getManageConfig: async () => server.pending ? new Promise(() => {}) : server.config, getManageLifecycle: async () => ({Configured: false}), putManageConfig: (...args: unknown[]) => server.save(...args)}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
HTMLDialogElement.prototype.showModal ??= function () {this.setAttribute("open", "");};
HTMLDialogElement.prototype.close ??= function () {this.removeAttribute("open");};

function page() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManualDraftProvider userID="user-a" eventID="event-a"><ParticipationSettingsPage /><a href="/manage/settings" onClick={event => event.preventDefault()}>next</a></ManualDraftProvider></QueryClientProvider>);
}
const team = () => screen.getByRole("radio", {name: new RegExp(t("manage.participation.team.title"))});
const individual = () => screen.getByRole("radio", {name: new RegExp(t("manage.participation.individual.title"))});
beforeEach(() => {sessionStorage.clear(); window.history.replaceState({}, "", "/manage/participation-settings"); server.pending = false; server.push.mockReset(); server.save.mockReset(); server.config = {Participation: 0, Registration: 0, MaxTeamSize: 3, MinTeamSize: null};});
afterEach(cleanup);

describe("real manual form recovery", () => {
    it("restores a changed participation radio after refresh", async () => {
        const first = page(); await screen.findByRole("radiogroup"); fireEvent.click(team()); first.unmount(); page();
        await waitFor(() => expect(team()).toHaveProperty("checked", true));
    });
    it("a changed then reverted form leaves without asking and clears the obsolete edit", async () => {
        const first = page(); await screen.findByRole("radiogroup"); fireEvent.click(team()); fireEvent.click(individual()); fireEvent.click(screen.getByText("next"));
        expect(screen.queryByText(t("manage.unsaved.title"))).toBeNull();
        first.unmount(); server.config = {...server.config, Participation: 1}; page(); await waitFor(() => expect(team()).toHaveProperty("checked", true));
    });
    it("a failed save leaves the draft recoverable", async () => {
        server.save.mockRejectedValue(new Error("offline")); const first = page(); await screen.findByRole("radiogroup"); fireEvent.click(team()); fireEvent.click(screen.getByText(t("common.save")));
        await waitFor(() => expect(server.save).toHaveBeenCalledOnce()); first.unmount(); page(); await waitFor(() => expect(team()).toHaveProperty("checked", true));
    });
    it("a successful save clears the draft", async () => {
        server.save.mockImplementation(async (_eventID, value) => (server.config = value)); const first = page(); await screen.findByRole("radiogroup"); fireEvent.click(team()); fireEvent.click(screen.getByText(t("common.save")));
        await waitFor(() => expect(Object.keys(sessionStorage).filter(key => key.startsWith("cib_manual_draft_")).length).toBe(0));
        first.unmount(); server.config = {...server.config, Participation: 0}; page(); await waitFor(() => expect(individual()).toHaveProperty("checked", true));
    });
    it("keeps changes typed while a previous save was pending", async () => {
        let done!: (value: unknown) => void; server.save.mockImplementation(() => new Promise(resolve => {done = resolve;}));
        const first = page(); await screen.findByRole("radiogroup"); fireEvent.click(team()); fireEvent.click(screen.getByText(t("common.save")));
        fireEvent.change(document.getElementById("max-team-size")!, {target: {value: "7"}});
        await act(async () => {done({...server.config, Participation: 1});}); first.unmount(); page();
        await waitFor(() => expect(document.getElementById("max-team-size")!).toHaveProperty("value", "7"));
    });
    it("guards a restored edit while its server baseline is unavailable", async () => {
        const first = page(); await screen.findByRole("radiogroup"); fireEvent.click(team()); first.unmount();
        server.pending = true; page(); fireEvent.click(screen.getByText("next"));
        expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy(); fireEvent.click(screen.getByText(t("common.cancel")));
        expect(Object.keys(sessionStorage).filter(key => key.startsWith("cib_manual_draft_")).length).toBeGreaterThan(0);
    });
    it("drops a reconciled edit on reversion so refresh sees later server changes", async () => {
        const first = page(); await screen.findByRole("radiogroup"); fireEvent.click(team()); fireEvent.click(individual()); first.unmount();
        server.config = {...server.config, Participation: 1}; page(); await waitFor(() => expect(team()).toHaveProperty("checked", true));
    });

});
