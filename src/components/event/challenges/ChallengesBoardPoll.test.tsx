// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {challengeSchema} from "@/api/participantChallenges";

const state = vi.hoisted(() => ({board: vi.fn(), toast: vi.fn()}));
vi.mock("react-hot-toast", () => ({toast: {error: state.toast}, default: {error: state.toast}}));
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), getOwnBoard: state.board}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: async () => ({ID: "u1"})}));
vi.mock("@/api/manage", () => ({getManageAccess: async () => ({CanManage: false})}));
vi.mock("@/api/moderatorsBoard", () => ({getModeratorsBoard: async () => []}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}}), EventVpnProvider: ({children}: {children: React.ReactNode}) => children}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/components/event/EventCountdown", () => ({EventCountdown: () => null, CountdownClock: () => null}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => ({
    event: {EventID: "e", Name: "Захід", Participation: 1, StartTime: "2026-01-01T00:00:00Z", FinishTime: null},
    participantInfo: {}, ownTeam: {ID: "t", Admitted: true, Formed: true, MemberCount: 2},
})}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => null}));
vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => null}));

const {ChallengesBoard} = await import("./ChallengesBoard");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const board = {
    Challenges: [challengeSchema.parse({ID: uuid(901), EventChallengeID: uuid(1), Snapshot: {name: "Завдання 1", difficulty: "easy"}, Readiness: 2, SolvedAt: null, Points: 100, Order: 1, GroupID: uuid(501), GroupName: "Група", GroupOrder: 1})],
    Stages: [], ServerNow: "2026-10-01T10:00:00Z", CurrentStage: null, NextOpensAt: null, NextChangeAt: null,
};

beforeEach(() => { HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); }; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><ChallengesBoard /></QueryClientProvider>);
    return client;
}

it("shows the load error only on a first load that failed", async () => {
    state.board.mockRejectedValue(new Error("down"));
    view();
    await screen.findByText("Не вдалося завантажити завдання");
    expect(state.toast).not.toHaveBeenCalled();
});

it("keeps the board and toasts when a background poll fails", async () => {
    state.board.mockResolvedValueOnce(board);
    const client = view();
    await screen.findByText("Завдання 1");
    state.board.mockRejectedValue(new Error("down"));
    await client.refetchQueries({queryKey: ["event-own-challenges", "e"]});
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith("Не вдалося оновити завдання", {id: "event-challenges-refresh"}));
    expect(screen.getByText("Завдання 1")).toBeTruthy();
    expect(document.querySelector("[data-load-error]")).toBeNull();
});
