// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {CreateTeamDialog} from "./CreateTeamDialog";
import {InviteParticipantsDialog} from "./InviteParticipantsDialog";
import {createManageTeams, sendInvitations} from "@/api/manageInvites";
import {t} from "@/i18n/t";

vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => null}));
vi.mock("@/api/manageParticipantForm", () => ({getManageParticipantForm: async () => null}));
vi.mock("@/api/manageParticipants", () => ({getManageParticipants: async () => ({Items: [], NextCursor: null})}));
vi.mock("@/api/manageInvites", () => ({sendInvitations: vi.fn(async () => [{Email: "a@example.test", UserID: "u1", Code: null}]), createManageTeams: vi.fn()}));
vi.mock("@/components/ui/EventSelect", () => ({EventSelect: ({ariaLabel, value, options, onValueChange}: {ariaLabel: string; value: string; options: {value: string; label: string}[]; onValueChange: (value: string) => void}) => <select aria-label={ariaLabel} value={value} onChange={event => onValueChange(event.target.value)}><option value="" />{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}));
afterEach(() => {cleanup(); vi.clearAllMocks();});

const wrap = (node: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>);

it("invite dialog: the emails checkbox is on by default and sends emails", async () => {
    wrap(<InviteParticipantsDialog eventID="e1" open onOpenChange={vi.fn()} onSent={vi.fn(async () => {})} />);
    const box = screen.getByRole("checkbox", {name: t("manage.invites.sendEmails")}) as HTMLInputElement;
    expect(box.checked).toBe(true);
    const emails = screen.getByRole("textbox", {name: /Адреси/});
    fireEvent.change(emails, {target: {value: "a@example.test"}});
    fireEvent.blur(emails);
    fireEvent.submit(emails.closest("form")!);
    await waitFor(() => expect(sendInvitations).toHaveBeenCalled());
    expect(vi.mocked(sendInvitations).mock.calls[0][3]).toBe(true);
});

it("invite dialog: unchecking sends the silent flag", async () => {
    wrap(<InviteParticipantsDialog eventID="e1" open onOpenChange={vi.fn()} onSent={vi.fn(async () => {})} team={{ID: "t1", Name: "Blue"}} />);
    fireEvent.click(screen.getByRole("checkbox", {name: t("manage.invites.sendEmails")}));
    expect(screen.getByRole("button", {name: t("manage.participants.invite.add")})).toBeTruthy();
    const emails = screen.getByRole("textbox", {name: /Адреси/});
    fireEvent.change(emails, {target: {value: "a@example.test"}});
    fireEvent.blur(emails);
    fireEvent.submit(emails.closest("form")!);
    await waitFor(() => expect(sendInvitations).toHaveBeenCalled());
    const call = vi.mocked(sendInvitations).mock.calls[0];
    expect(call[2]).toBe("t1");
    expect(call[3]).toBe(false);
});

function fillTeam() {
    const name = screen.getByRole("textbox", {name: /Назва/});
    fireEvent.change(name, {target: {value: "Alpha"}});
    const members = screen.getByRole("textbox", {name: /Учасники команди/});
    fireEvent.change(members, {target: {value: "one@example.test"}});
    fireEvent.blur(members);
    fireEvent.change(screen.getByRole("combobox", {name: t("manage.teams.captain")}), {target: {value: "one@example.test"}});
    return name.closest("form")!;
}

it("team dialog: emails on by default, unchecking sends the silent flag", async () => {
    vi.mocked(createManageTeams).mockResolvedValue({Teams: [{ID: "00000000-0000-4000-8000-000000000001", Name: "Alpha", Created: true}], Assigned: 1, Invited: 0, Unchanged: 0, NotSent: [], Issues: []});
    wrap(<CreateTeamDialog eventID="e1" open onOpenChange={vi.fn()} onCreated={vi.fn(async () => {})} />);
    const box = screen.getByRole("checkbox", {name: t("manage.invites.sendEmails")}) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    fireEvent.submit(fillTeam());
    await waitFor(() => expect(createManageTeams).toHaveBeenCalled());
    expect(vi.mocked(createManageTeams).mock.calls[0][4]).toBe(false);
});

it("team dialog: checked sends emails", async () => {
    vi.mocked(createManageTeams).mockResolvedValue({Teams: [], Assigned: 0, Invited: 1, Unchanged: 0, NotSent: [], Issues: []});
    wrap(<CreateTeamDialog eventID="e1" open onOpenChange={vi.fn()} onCreated={vi.fn(async () => {})} />);
    fireEvent.submit(fillTeam());
    await waitFor(() => expect(createManageTeams).toHaveBeenCalled());
    expect(vi.mocked(createManageTeams).mock.calls[0][4]).toBe(true);
});
