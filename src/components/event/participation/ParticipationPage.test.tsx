// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import {TeamRole, type TeamMember} from "@/api/eventTeams";
import type {OwnTeam} from "@/api/clientAuth";
import {ParticipationPage} from "./ParticipationPage";

const state = vi.hoisted(() => ({
    participant: null as unknown,
    guest: null as unknown,
    staff: false,
    rosterOpen: true,
    members: [] as unknown[],
    missing: [] as string[],
    moderators: null as unknown,
}));

vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => state.participant}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => state.guest}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: state.staff, pending: false})}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: ({label}: {label?: string}) => <div>{label}</div>}));
vi.mock("@/api/clientAuth", () => ({getRegistrationWindow: async () => ({registrationOpen: true, joinPolicy: "rolling", startAt: "", finishAt: "", rosterOpen: state.rosterOpen})}));
vi.mock("@/api/participantForm", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/participantForm")>()),
    getOwnParticipantAnswers: async () => ({Form: {Fields: []}, Answers: {}, Editable: true, Missing: state.missing, Blocking: false}),
}));
vi.mock("@/api/moderatorsBoard", () => ({getModeratorsTeam: async () => { if (!state.moderators) throw new Error("unavailable"); return state.moderators; }}));
vi.mock("@/api/eventTeams", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/eventTeams")>()),
    getOwnTeamMembers: async () => state.members,
    getSelfTeamFields: async () => null,
}));

const event = {EventID: "event-1", Name: "Олімпіада", Participation: 1, StartTime: "2026-01-01T00:00:00Z", FinishTime: null};
const info = {MinTeamSize: 2, MaxTeamSize: 4};
const team = (role: number, extra: Partial<OwnTeam> = {}): OwnTeam => ({
    ID: "00000000-0000-4000-8000-0000000000aa", Name: "Сині", MemberCount: 2, ExtraFields: {}, JoinCode: "", JoinCodeExpiresAt: null, Role: role, Admitted: true, MinTeamSize: 2, MaxTeamSize: 4, ...extra,
});
const member = (id: string, name: string, role: number, own: boolean, pending = false): TeamMember => ({UserID: `00000000-0000-4000-8000-00000000000${id}`, DisplayName: name, Role: role, Own: own, Pending: pending});

function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ParticipationPage /></QueryClientProvider>);
}

beforeEach(() => {
    state.participant = null; state.guest = null; state.staff = false; state.rosterOpen = true; state.members = []; state.moderators = null; state.missing = [];
    window.history.replaceState(null, "", "/participation?tab=team");
    sessionStorage.clear();
});
afterEach(cleanup);

it("gives the captain the join link with copy and reissue", async () => {
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Captain, {JoinCode: "secret-code"})};
    state.members = [member("1", "Олена", TeamRole.Captain, true), member("2", "Іван", TeamRole.Member, false), member("3", "Марія", TeamRole.Member, false, true)];
    view();
    const link = await screen.findByLabelText<HTMLInputElement>("Посилання для запрошення");
    expect(link.value).toBe(`${window.location.origin}/participation?tab=team&join=secret-code`);
    expect(screen.getByRole("button", {name: "Копіювати"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Перевипустити"})).toBeTruthy();
    expect(await screen.findByText("Очікує підтвердження")).toBeTruthy();
    expect(screen.getAllByRole("button", {name: "Виключити"})).toHaveLength(1);
});

it("shows a regular member the team and its roster but no join link", async () => {
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member)};
    state.members = [member("1", "Олена", TeamRole.Captain, false), member("2", "Іван", TeamRole.Member, true)];
    view();
    expect(await screen.findByText("Олена")).toBeTruthy();
    expect(screen.queryByLabelText("Посилання для запрошення")).toBeNull();
    expect(screen.queryByRole("button", {name: "Перевипустити"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Виключити"})).toBeNull();
    expect(screen.getByRole("button", {name: "Вийти з команди"})).toBeTruthy();
});

it("hides the roster management once the roster is closed", async () => {
    state.rosterOpen = false;
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Captain, {JoinCode: "secret-code"})};
    state.members = [member("1", "Олена", TeamRole.Captain, true), member("2", "Іван", TeamRole.Member, false)];
    view();
    expect(await screen.findByLabelText("Посилання для запрошення")).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Перевипустити"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Виключити"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Розпустити команду"})).toBeNull();
});

it("shows organizers the real moderators team, read-only", async () => {
    state.guest = event;
    state.staff = true;
    state.moderators = {TeamID: "00000000-0000-4000-8000-0000000000bb", Members: [{UserID: "00000000-0000-4000-8000-0000000000c1", Name: "Олена Коваль", Role: 1}]};
    view();
    expect(await screen.findByText("Перевірка завдань від імені команди модераторів")).toBeTruthy();
    expect(screen.getByText("Олена Коваль")).toBeTruthy();
    expect(screen.getByText("Команда модераторів")).toBeTruthy();
    expect(screen.queryByLabelText("Посилання для запрошення")).toBeNull();
    expect(screen.queryByRole("button", {name: "Розпустити команду"})).toBeNull();
});

it("lets organizers open the page as a captain with sample data when there is no moderators team", async () => {
    state.guest = event;
    state.staff = true;
    view();
    expect(await screen.findByText("Перегляд для організаторів")).toBeTruthy();
    expect(screen.getByText("Команда «Зразок»")).toBeTruthy();
    expect(screen.getByLabelText("Посилання для запрошення")).toBeTruthy();
});

it("asks a visitor with a join link to register first and remembers the code", async () => {
    state.guest = event;
    window.history.replaceState(null, "", "/participation?tab=team&join=abc");
    view();
    expect(await screen.findByText(/спершу зареєструйтеся/)).toBeTruthy();
    expect(sessionStorage.getItem("event-team-join-code")).toBe("abc");
});

const individual = {...event, Participation: 0};

it("opens the team tab by default for a captain whose team is below the minimum", async () => {
    window.history.replaceState(null, "", "/participation");
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Captain, {MemberCount: 1, JoinCode: "code"})};
    state.members = [member("1", "Олена", TeamRole.Captain, true)];
    view();
    expect(await screen.findByLabelText("Посилання для запрошення")).toBeTruthy();
    expect(screen.getByRole("tab", {name: "Команда"}).getAttribute("aria-selected")).toBe("true");
});

it("opens the team tab for a captain with a pending invitation even when the minimum is met", async () => {
    window.history.replaceState(null, "", "/participation");
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Captain, {JoinCode: "code"})};
    state.members = [member("1", "Олена", TeamRole.Captain, true), member("2", "Іван", TeamRole.Member, false), member("3", "Марія", TeamRole.Member, false, true)];
    view();
    expect(await screen.findByText("Очікує підтвердження")).toBeTruthy();
});

it("opens the profile by default for a complete team and for a member", async () => {
    window.history.replaceState(null, "", "/participation");
    state.participant = {event, participantInfo: {...info, RealName: "Олена Коваль", AllowPseudonyms: false}, ownTeam: team(TeamRole.Member)};
    view();
    expect(await screen.findByText("Олена Коваль")).toBeTruthy();
    expect(screen.getByRole("tab", {name: "Профіль"}).getAttribute("aria-selected")).toBe("true");
});

it("has no tabs in individual mode, even for ?tab=team", async () => {
    state.participant = {event: individual, participantInfo: {...info, RealName: "Олена Коваль", AllowPseudonyms: false}, ownTeam: null};
    view();
    expect(await screen.findByText("Олена Коваль")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab", {name: "Команда"})).toBeNull();
});

it("marks a tab whose section has missing fields", async () => {
    window.history.replaceState(null, "", "/participation");
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member, {MissingFields: ["school"]})};
    state.missing = ["phone"];
    view();
    await screen.findByRole("tab", {name: /Профіль/});
    expect((await screen.findByRole("tab", {name: /Профіль/})).textContent).toContain("Заповніть");
    expect(screen.getByRole("tab", {name: /Команда/}).textContent).toContain("Заповніть");
});
