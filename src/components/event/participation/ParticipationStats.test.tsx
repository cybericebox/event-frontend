// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import {TeamRole, type TeamMember} from "@/api/eventTeams";
import type {OwnTeam} from "@/api/clientAuth";
import type {ParticipationStats} from "@/api/participationStats";
import {ParticipationPage} from "./ParticipationPage";

const state = vi.hoisted(() => ({
    participant: null as unknown,
    stats: null as unknown,
    statsError: false,
    statsPending: false,
    members: [] as unknown[],
    answers: {Form: {Version: 1, Enabled: false, Required: false, Document: {blocks: []}}, Answers: {}, Editable: true, Missing: [] as string[]} as unknown,
}));

vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("echarts-for-react", () => ({default: () => <div data-testid="chart" />}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => state.participant}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => null}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: false, pending: false})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false}), StandStatusIcon: () => null, standStatusText: () => ({title: "", note: ""})}));
vi.mock("@/api/clientAuth", () => ({getParticipation: async () => ({Phase: "started", Staff: false, RosterOpen: true, RosterReason: ""})}));
vi.mock("@/api/participantForm", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/participantForm")>()),
    getOwnParticipantAnswers: async () => state.answers,
}));
vi.mock("@/api/participationStats", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/participationStats")>()),
    getParticipationStats: async () => {
        if (state.statsPending) return new Promise(() => undefined);
        if (state.statsError) throw new Error("boom");
        return state.stats;
    },
}));
vi.mock("@/api/eventTeams", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/eventTeams")>()),
    getOwnTeamMembers: async () => state.members,
    getSelfTeamFields: async () => null,
}));

const ME = "00000000-0000-4000-8000-000000000001";
const MATE = "00000000-0000-4000-8000-000000000002";
const event = {EventID: "event-1", Name: "Олімпіада", Participation: 1, StartTime: "2026-01-01T00:00:00Z", FinishTime: null};
const info = {MinTeamSize: 2, MaxTeamSize: 4, RealName: "Олена Коваль", DisplayName: "Олена Коваль", AllowPseudonyms: false};
const team = (role: number, extra: Partial<OwnTeam> = {}): OwnTeam => ({
    ID: "00000000-0000-4000-8000-0000000000aa", Name: "Сині", MemberCount: 2, ExtraFields: {}, JoinCode: "", JoinCodeExpiresAt: null, Role: role, Admitted: true, MinTeamSize: 2, MaxTeamSize: 4, ...extra,
});
const member = (id: string, name: string, role: number, own: boolean, pending = false): TeamMember => ({UserID: id, DisplayName: name, Role: role, Own: own, Pending: pending});
const person = (id: string, name: string, points: number, solves: number) => ({UserID: id, Name: name, Role: 0, JoinedAt: "2026-01-01T01:00:00Z", Points: points, Solves: solves, FirstBloods: 0, Attempts: 4, CorrectAttempts: solves, Hints: 1});
const stats = (overrides: Partial<ParticipationStats> = {}): ParticipationStats => ({
    Rank: 3, Points: 500, Solved: 2, Frozen: false,
    Team: {
        TeamID: "t", TeamName: "Сині", Attempts: 8, CorrectAttempts: 2, Hints: 2, FirstBloods: 1,
        Solves: [
            {EventChallengeID: "c1", ChallengeName: "Веб-один", Category: "Web", Points: 200, SolvedAt: "2026-01-01T02:00:00Z", SolvedByUserID: ME, SolvedByName: "Олена", FirstBlood: true},
            {EventChallengeID: "c2", ChallengeName: "Крипто-два", Category: "Crypto", Points: 300, SolvedAt: "2026-01-01T03:00:00Z", SolvedByUserID: MATE, SolvedByName: "Іван", FirstBlood: false},
        ],
        Members: [person(ME, "Олена", 200, 1), person(MATE, "Іван", 300, 1)],
    },
    Me: person(ME, "Олена", 200, 1),
    Timeline: [{Points: 200, SolvedAt: "2026-01-01T02:00:00Z"}, {Points: 300, SolvedAt: "2026-01-01T03:00:00Z"}],
    ...overrides,
});

function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ParticipationPage /></QueryClientProvider>);
}

beforeEach(() => {
    state.participant = null; state.stats = stats(); state.statsError = false; state.statsPending = false; state.members = [];
    state.answers = {Form: {Version: 1, Enabled: false, Required: false, Document: {blocks: []}}, Answers: {}, Editable: true, Missing: []};
    window.history.replaceState(null, "", "/participation");
    sessionStorage.clear();
});
afterEach(cleanup);

it("shows the participant their place, own figures and only their own solves, never the wrong answers", async () => {
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member)};
    view();
    expect(await screen.findByText("3 місце")).toBeTruthy();
    expect(screen.getByText("Веб-один")).toBeTruthy();
    expect(screen.queryByText("Крипто-два")).toBeNull();
    expect(screen.getByText("Криголам")).toBeTruthy();
    expect(screen.getByText("Успішних: 25%")).toBeTruthy();
    expect(screen.getAllByTestId("chart").length).toBe(2);
});

it("centres the chart error in its block and retries", async () => {
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member)};
    state.statsError = true;
    view();
    expect((await screen.findAllByText("Не вдалося завантажити діаграму.")).length).toBe(2);
    expect(screen.getAllByRole("button", {name: "Спробувати ще раз"}).length).toBeGreaterThan(0);
});

it("shows the loading state in the chart blocks while the results load", async () => {
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member)};
    state.statsPending = true;
    view();
    expect((await screen.findAllByRole("status", {name: "Завантажуємо діаграму…"})).length).toBe(2);
});

it("shows the empty states before the first solve", async () => {
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member)};
    state.stats = stats({Team: {...stats().Team, Solves: []}, Timeline: [], Solved: 0, Points: 0});
    view();
    expect(await screen.findByText("Бали зʼявляться після першого розвʼязаного завдання.")).toBeTruthy();
    expect(screen.getByText("Розвʼязаних завдань поки немає.")).toBeTruthy();
});

it("has no tabs in individual mode and reads the whole result as the participant's own", async () => {
    state.participant = {event: {...event, Participation: 0}, participantInfo: info, ownTeam: null};
    view();
    expect(await screen.findByText("Місце")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(await screen.findByText("Крипто-два")).toBeTruthy();
});

it("marks the required answers still owed and opens the form from the questionnaire card", async () => {
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member)};
    state.answers = {Form: {Version: 1, Enabled: true, Required: true, Document: {blocks: [{id: "p", type: "field", key: "phone", input: "text", label: "Телефон", required: true}]}}, Answers: {}, Editable: true, Missing: ["phone"]};
    view();
    expect((await screen.findAllByText("Заповніть", {selector: ".ib-tag"})).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
    expect(screen.getByLabelText(/Телефон/)).toBeTruthy();
});

it("gives the captain the roster with contributions, pending invitees, the link and the actions", async () => {
    window.history.replaceState(null, "", "/participation?tab=team");
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Captain, {JoinCode: "secret"})};
    state.members = [member(ME, "Олена", TeamRole.Captain, true), member(MATE, "Іван", TeamRole.Member, false), member("p1", "Марія", TeamRole.Member, false, true)];
    view();
    const roster = await screen.findByRole("region", {name: "Учасники"});
    expect(within(roster).getByText("Очікує підтвердження")).toBeTruthy();
    expect(within(roster).getByText("300")).toBeTruthy();
    expect(within(roster).getAllByRole("button", {name: /^Виключити /})).toHaveLength(1);
    expect((screen.getByLabelText("Посилання для запрошення") as HTMLInputElement).value).toContain("join=secret");
    expect(screen.getByRole("button", {name: "Перевипустити"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Розпустити команду"})).toBeTruthy();
    expect(screen.getByText("Розвʼязав")).toBeTruthy();
    expect(screen.getByText("Успішність")).toBeTruthy();
});

it("tells a member how to ask the captain and offers only leaving", async () => {
    window.history.replaceState(null, "", "/participation?tab=team");
    state.participant = {event, participantInfo: info, ownTeam: team(TeamRole.Member)};
    state.members = [member(ME, "Олена", TeamRole.Captain, false), member(MATE, "Іван", TeamRole.Member, true)];
    view();
    expect(await screen.findByText(/Запросити людей у команду може капітан \(Олена\)/)).toBeTruthy();
    expect(screen.queryByLabelText("Посилання для запрошення")).toBeNull();
    expect(screen.queryByRole("button", {name: /^Виключити /})).toBeNull();
    expect(screen.getByRole("button", {name: "Вийти з команди"})).toBeTruthy();
});
