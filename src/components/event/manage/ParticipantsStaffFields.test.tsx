// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {useSyncExternalStore} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ManageParticipant} from "@/api/manageParticipants";
import {decideManageParticipant} from "@/api/manageParticipants";
import {ParticipantsManager} from "./ParticipantsManager";

// jsdom has no top-layer dialog (ConfirmDialog is native).
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

let form: ParticipantForm;
let rows: ManageParticipant[];
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Participation: 0}, canManage: true})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
const nav = vi.hoisted(() => ({state: {search: ""}, listeners: new Set<() => void>()}));
vi.mock("next/navigation", () => ({
    usePathname: () => "/manage/participants",
    useRouter: () => ({replace: (url: string) => {nav.state.search = url.split("?")[1] ?? ""; window.history.replaceState(null, "", url); nav.listeners.forEach(listener => listener());}}),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(listener => {nav.listeners.add(listener); return () => nav.listeners.delete(listener);}, () => nav.state.search, () => nav.state.search)),
}));
vi.mock("next/link", () => ({default: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));
vi.mock("@/api/manage", async original => ({...(await original() as object), getManageConfig: async () => ({AllowPseudonyms: false})}));
vi.mock("@/api/manageParticipantForm", async original => ({...(await original() as object), getManageParticipantForm: async () => form}));
vi.mock("@/api/manageTeams", () => ({getManageTeams: async () => ({Items: [], Total: 0})}));
vi.mock("@/api/manageListColumns", () => ({getManageListColumns: async () => ({List: "participants", Columns: []}), putManageListColumns: vi.fn()}));
vi.mock("@/api/manageStaffFields", () => ({
    getManageStaffFields: async () => ({Values: {note: "VIP"}, Change: {Keys: ["note"], ActorName: "Олена", At: "2026-09-29T10:00:00Z"}}),
    putManageStaffFields: vi.fn(),
}));
vi.mock("@/api/manageParticipants", async original => ({
    ...(await original() as object),
    decideManageParticipant: vi.fn(async () => ({})),
    getManageParticipant: async (_event: string, id: string) => ({...rows.find(row => row.UserID === id)!, TeamRole: null, JoinedVia: "open", Attempts: 0, Solves: 0}),
    getManageParticipantsTable: async () => ({Items: rows, Total: rows.length, Page: 1, PageSize: 25, Counts: {Participants: rows.length, Applications: 0, Invitations: 0}}),
}));

const field = (key: string, label: string, extra: Partial<FormField> = {}): FormField => ({id: key, type: "field", key, input: "text", label, ...extra});
const person = (id: string, name: string, extra: Partial<ManageParticipant> = {}): ManageParticipant => ({
    UserID: id, Name: name, Email: `${id}@test.test`, Pseudonym: "", DisplayName: name, TeamID: null, TeamName: "", Hidden: false, Invited: false, InvitedToTeam: false,
    InvitedTeamID: null, InvitedTeamName: "", InvitationSentAt: null, InvitationExpired: false, Status: 2, CreatedAt: "2026-09-01T10:00:00Z", DecidedAt: null,
    Answers: {}, FieldsMissing: 0, LastSeenAt: null, LastLabAt: null, ...extra,
});

beforeEach(() => {
    nav.state.search = "";
    window.history.replaceState(null, "", "/manage/participants");
    form = {Version: 2, Enabled: true, Required: true, Document: {blocks: [
        field("city", "Місто", {required: true}), field("note", "Нотатка організаторів", {input: "long_text", staffOnly: true}),
    ]}};
    rows = [person("aaaaaaaa-1", "Олена Коваль", {FieldsMissing: 2, Answers: {city: "Київ", note: "VIP"}}), person("bbbbbbbb-2", "Ігор Мельник", {Answers: {city: "Львів"}})];
});
afterEach(cleanup);

function renderManager() {
    render(<QueryClientProvider client={new QueryClient()}><ParticipantsManager initialTab="participants" /></QueryClientProvider>);
}

describe("required fields asked from everyone (participants table)", () => {
    it("shows a «Не заповнено» column with the number of missing fields", async () => {
        form = {...form, RequireExisting: true};
        renderManager();
        await screen.findByText("Олена Коваль");
        const header = screen.getAllByRole("columnheader").find(cell => cell.textContent?.includes("Не заповнено"));
        expect(header).toBeTruthy();
        const row = screen.getByText("Олена Коваль").closest("tr")!;
        expect(within(row).getByText("2")).toBeTruthy();
        const other = screen.getByText("Ігор Мельник").closest("tr")!;
        expect(within(other).queryByText("2")).toBeNull();
    });

    it("has no such column while only new registrations are asked", async () => {
        renderManager();
        await screen.findByText("Олена Коваль");
        expect(screen.getAllByRole("columnheader").some(cell => cell.textContent?.includes("Не заповнено"))).toBe(false);
    });
});

describe("staff-only fields (participants table)", () => {
    it("are columns like any field, and editable in the row dialog", async () => {
        renderManager();
        await screen.findByText("Олена Коваль");
        expect(screen.getAllByRole("columnheader").some(cell => cell.textContent?.includes("Нотатка організаторів"))).toBe(true);
        fireEvent.click(screen.getByText("Олена Коваль").closest("tr")!);
        const dialog = await screen.findByRole("dialog");
        expect(await within(dialog).findByText("Службові поля")).toBeTruthy();
        expect(await within(dialog).findByDisplayValue("VIP")).toBeTruthy();
        expect(within(dialog).getByText(/Востаннє змінено: Олена/)).toBeTruthy();
        // the answers list keeps the participant's own answers only
        expect(within(dialog).getAllByText("Нотатка організаторів")).toHaveLength(1);
    });

    it("no panel when the form has no staff-only field", async () => {
        form = {...form, Document: {blocks: [field("city", "Місто")]}};
        renderManager();
        await screen.findByText("Олена Коваль");
        fireEvent.click(screen.getByText("Олена Коваль").closest("tr")!);
        const dialog = await screen.findByRole("dialog");
        await waitFor(() => expect(within(dialog).queryByText("Службові поля")).toBeNull());
    });
});

describe("participant dialog", () => {
    it("is the standard centred modal", async () => {
        renderManager();
        await screen.findByText("Олена Коваль");
        fireEvent.click(screen.getByText("Олена Коваль").closest("tr")!);
        const dialog = await screen.findByRole("dialog");
        expect(dialog.classList.contains("ib-modal")).toBe(true);
        expect(dialog.parentElement?.classList.contains("ib-modal-backdrop")).toBe(true);
        expect(within(dialog).getByText("Київ")).toBeTruthy();
    });

    it("approves and rejects a pending application from the footer", async () => {
        rows = [person("cccccccc-3", "Марта Іваненко", {Status: 1, Answers: {city: "Одеса"}})];
        render(<QueryClientProvider client={new QueryClient()}><ParticipantsManager initialTab="applications" /></QueryClientProvider>);
        await screen.findByText("Марта Іваненко");
        fireEvent.click(screen.getByText("Марта Іваненко").closest("tr")!);
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", {name: "Підтвердити"}));
        await waitFor(() => expect(decideManageParticipant).toHaveBeenCalledWith("e1", "cccccccc-3", "approve"));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        fireEvent.click(screen.getByText("Марта Іваненко").closest("tr")!);
        fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", {name: "Відхилити"}));
        const confirm = await screen.findByRole("alertdialog");
        fireEvent.click(within(confirm).getByRole("button", {name: "Відхилити"}));
        await waitFor(() => expect(decideManageParticipant).toHaveBeenCalledWith("e1", "cccccccc-3", "reject"));
    });
});
