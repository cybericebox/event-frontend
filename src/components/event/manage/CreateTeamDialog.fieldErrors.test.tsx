// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {CreateTeamDialog} from "./CreateTeamDialog";
import {createManageTeams} from "@/api/manageInvites";
import {t} from "@/i18n/t";

vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => null}));
vi.mock("@/api/manageParticipantForm", () => ({getManageParticipantForm: async () => null}));
vi.mock("@/api/manageParticipants", () => ({getManageParticipants: async () => ({Items: [], NextCursor: null})}));
vi.mock("@/api/manageInvites", () => ({createManageTeams: vi.fn()}));
vi.mock("@/components/ui/EventSelect", () => ({EventSelect: ({ariaLabel, value, options, onValueChange}: {ariaLabel: string; value: string; options: {value: string; label: string}[]; onValueChange: (value: string) => void}) => <select aria-label={ariaLabel} value={value} onChange={event => onValueChange(event.target.value)}><option value="" />{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}));
afterEach(() => {cleanup(); vi.clearAllMocks();});

it("shows each manual batch validation issue beside its matching control and keeps whole-batch issues separate", async () => {
    vi.mocked(createManageTeams).mockResolvedValue({Teams: [], Assigned: 0, Invited: 0, Unchanged: 0, NotSent: [], Issues: [
        {Team: 0, Email: "", Code: "team_exists"}, {Team: 0, Email: "", Code: "captain_invalid"},
        {Team: 0, Email: "one@example.test", Code: "already_in_team"}, {Team: 0, Email: "", Code: "too_many_teams"},
    ]});
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><CreateTeamDialog eventID="e1" open onOpenChange={vi.fn()} onCreated={vi.fn()} /></QueryClientProvider>);
    const name = screen.getByRole("textbox", {name: /Назва/});
    fireEvent.change(name, {target: {value: "Alpha"}});
    const members = screen.getByRole("textbox", {name: /Учасники команди/});
    fireEvent.change(members, {target: {value: "one@example.test"}});
    fireEvent.blur(members);
    const captain = screen.getByRole("combobox", {name: t("manage.teams.captain")});
    fireEvent.change(captain, {target: {value: "one@example.test"}});
    fireEvent.submit(name.closest("form")!);
    await waitFor(() => expect(name.getAttribute("aria-invalid")).toBe("true"));
    expect(name.closest(".ib-field")?.contains(document.getElementById(name.getAttribute("aria-describedby")!))).toBe(true);
    for (const control of [members, captain]) {
        const group = control.closest('[role="group"]')!;
        expect(group.getAttribute("aria-invalid")).toBe("true");
        expect(group.contains(document.getElementById(group.getAttribute("aria-describedby")!))).toBe(true);
        expect(group.textContent).not.toContain(t("manage.teams.batch.issue.too_many_teams"));
    }
    expect(screen.getByText(t("manage.teams.batch.issue.too_many_teams"))).toBeTruthy();
});
