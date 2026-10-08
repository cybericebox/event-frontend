// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState} from "react";
import {challengeSchema, ownBoardSchema, type OwnBoard, type OwnChallenge} from "@/api/participantChallenges";
import type {LabRuntime} from "@/api/manageLabs";
import {runningLab, completedLab} from "@/test/labLifecycle";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {markSolved} from "./challengeBoardModel";

const api = vi.hoisted(() => ({submit: vi.fn(), moderator: vi.fn(), board: vi.fn(), runtime: vi.fn()}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: async () => ({ID: "u1"})}));
vi.mock("@/components/event/EventCountdown", () => ({EventCountdown: () => null}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => ({
    event: {EventID: "e", Name: "Захід", Participation: 1, StartTime: "2026-01-01T00:00:00Z", FinishTime: null},
    participantInfo: {}, ownTeam: {ID: "team-a", Admitted: true, Formed: true, MemberCount: 2},
})}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => null}));
vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => null}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}}), EventVpnProvider: ({children}: {children: React.ReactNode}) => children}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/moderatorsBoard", async importOriginal => ({...await importOriginal<typeof import("@/api/moderatorsBoard")>(), submitModeratorFlag: (...args: unknown[]) => api.moderator(...args)}));
vi.mock("@/api/participantChallenges", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/participantChallenges")>(),
    getOwnBoard: (...args: unknown[]) => api.board(...args),
    getOwnChallengeLab: (...args: unknown[]) => api.runtime(...args) ?? new Promise(() => {}),
    submitChallenge: (...args: unknown[]) => api.submit(...args),
}));

const {ChallengeModal} = await import("./ChallengeModal");
const {ChallengeTile} = await import("./ChallengeTile");
const {Board, ChallengesBoard} = await import("./ChallengesBoard");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); api.submit.mockReset(); api.moderator.mockReset(); api.board.mockReset(); api.runtime.mockReset(); window.history.replaceState(null, "", "/challenges");});

const base: OwnChallenge = {...fixtureChallenge, SolvedAt: null, Infrastructure: false, Practice: false, Points: 100, AttemptsLeft: null};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const noop = () => {};

function renderModal(challenge: OwnChallenge) {
    render(<QueryClientProvider client={new QueryClient()}>
        <ChallengeModal challenge={challenge} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={noop} onAccepted={noop} />
    </QueryClientProvider>);
}

describe("solved task card", () => {
    it("is a distinct success state with the check and the awarded points, unsolved stays as is", () => {
        const {container, rerender} = render(<ChallengeTile challenge={{...base, SolvedAt: "2026-10-01T11:52:00Z", AwardedPoints: 80}} onOpen={noop} />);
        const tile = container.querySelector(".ib-tile")!;
        expect(tile.classList.contains("is-solved")).toBe(true);
        expect(tile.querySelector(".ib-tile__pts")?.textContent).toBe("+80");
        expect(tile.querySelector(".ib-tile__solved svg")).toBeTruthy();
        rerender(<ChallengeTile challenge={base} onOpen={noop} />);
        expect(container.querySelector(".ib-tile")!.classList.contains("is-solved")).toBe(false);
        expect(container.querySelector(".ib-tile__pts")?.textContent).toBe("100");
    });
});

describe("authoritative shared Lab on the participant board", () => {
    const otherLab = {...runningLab, ID: uuid(101)};
    const questions = [1, 2, 3].map(n => ({...base, ID: uuid(900 + n), EventChallengeID: uuid(n),
        Snapshot: {...base.Snapshot, name: `Завдання ${n}`, description: {}},
        Infrastructure: true, Hints: [], Order: n, Lab: n === 3 ? otherLab : runningLab}));
    const initial = ownBoardSchema.parse({ServerNow: "2026-10-08T12:00:00Z", Challenges: questions});
    const key = ["event-own-challenges", "e"];
    const labKey = (event: string, id: string, mode = "participant") => ["event-lab-lifecycle", mode, event, id];
    const send = async () => {
        fireEvent.change(screen.getByLabelText("Прапор"), {target: {value: "ICE{ok}"}});
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Надіслати"}));});
    };
    const start = async () => {
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        api.board.mockResolvedValue(initial);
        render(<QueryClientProvider client={client}><ChallengesBoard /></QueryClientProvider>);
        await screen.findByText("Завдання 1");
        return client;
    };

    it("applies question solves immediately, closes only the shared Lab and rejects delayed board/runtime reopening", async () => {
        const client = await start();
        client.setQueryData(labKey("other-event", runningLab.ID), runningLab);
        client.setQueryData(labKey("e", runningLab.ID, "moderators"), runningLab);
        let runtimeReply!: (value: LabRuntime) => void;
        api.runtime.mockImplementation(() => new Promise<LabRuntime>(resolve => {runtimeReply = resolve;}));
        let boardReply!: (value: OwnBoard) => void;
        api.board.mockImplementation(() => new Promise<OwnBoard>(resolve => {boardReply = resolve;}));
        api.submit.mockResolvedValueOnce({Correct: true, FirstSolve: true, Practice: false, Lab: runningLab})
            .mockResolvedValueOnce({Correct: true, FirstSolve: true, Practice: false, Lab: completedLab});
        fireEvent.click(screen.getByRole("button", {name: /^Завдання 1/}));
        await send();
        const first = client.getQueryData<OwnBoard>(key)!;
        expect(first.Challenges.map(item => !!item.SolvedAt)).toEqual([true, false, false]);
        expect(first.Challenges.map(item => item.Lab?.LogicalClosed)).toEqual([false, false, false]);
        fireEvent.click(screen.getByRole("button", {name: "Закрити"}));
        fireEvent.click(screen.getByRole("button", {name: /^Завдання 2/}));
        await send();
        const final = client.getQueryData<OwnBoard>(key)!;
        expect(final.Challenges.map(item => !!item.SolvedAt)).toEqual([true, true, false]);
        expect(final.Challenges.map(item => item.Lab?.LogicalClosed)).toEqual([true, true, false]);
        expect(client.getQueryData(labKey("other-event", runningLab.ID))).toEqual(runningLab);
        expect(client.getQueryData(labKey("e", runningLab.ID, "moderators"))).toEqual(runningLab);
        const dialog = document.querySelector("dialog");
        await act(async () => {boardReply(initial); runtimeReply({Lab: runningLab, Phase: "Ready", Ready: true, VPNCIDR: "", InternetCIDR: "", Access: [], Queue: null});});
        await waitFor(() => expect(client.getQueryData<OwnBoard>(key)!.Challenges[0].Lab?.LogicalClosed).toBe(true));
        await waitFor(() => expect(client.getQueryData<LabRuntime>(["event-challenge-lab", "participant", "e", uuid(2)])?.Lab).toEqual(runningLab));
        expect(screen.getByText("Усі завдання цього середовища виконано. Середовище закрито.")).toBeTruthy();
        expect(document.querySelector("dialog")).toBe(dialog);
        expect(client.getQueryData(labKey("e", otherLab.ID))).toEqual(otherLab);
    });

    it("practice follows the accepted path without creating a rated solve", async () => {
        const client = await start();
        api.board.mockImplementation(() => new Promise(() => {}));
        api.submit.mockResolvedValue({Correct: true, FirstSolve: false, Practice: true, Lab: completedLab});
        fireEvent.click(screen.getByRole("button", {name: /^Завдання 1/}));
        await send();
        const result = client.getQueryData<OwnBoard>(key)!;
        expect(result.Challenges[0]).toMatchObject({Practice: true, SolvedAt: null, AwardedPoints: null});
        expect(result.Challenges.map(item => item.Lab?.LogicalClosed)).toEqual([true, true, false]);
        expect(screen.getByText("Розвʼязано (практика, без балів)")).toBeTruthy();
        expect(screen.queryByText(/^\+\d/)).toBeNull();
    });

    it("still accepts a pending solve after closing its dialog in the same session", async () => {
        const client = await start();
        let reply!: (value: object) => void;
        api.submit.mockImplementation(() => new Promise(resolve => {reply = resolve;}));
        fireEvent.click(screen.getByRole("button", {name: /^Завдання 1/}));
        await send();
        fireEvent.click(screen.getByRole("button", {name: "Закрити"}));
        await act(async () => {await client.refetchQueries({queryKey: key, exact: true});});
        api.board.mockImplementation(() => new Promise(() => {}));
        await act(async () => {reply({Correct: true, FirstSolve: true, Practice: false, Lab: completedLab});});
        const result = client.getQueryData<OwnBoard>(key)!;
        expect(result.Challenges.map(item => !!item.SolvedAt)).toEqual([true, false, false]);
        expect(result.Challenges.map(item => item.Lab?.LogicalClosed)).toEqual([true, true, false]);
    });

    it("rejects a previous session's solve even when a new session builds the same lifecycle key", async () => {
        const client = await start();
        let reply!: (value: object) => void;
        api.submit.mockImplementation(() => new Promise(resolve => {reply = resolve;}));
        fireEvent.click(screen.getByRole("button", {name: /^Завдання 1/}));
        await send();
        api.board.mockImplementation(() => new Promise(() => {}));
        client.clear();
        client.setQueryData(labKey("e", runningLab.ID), runningLab);
        client.setQueryData(key, initial);
        await act(async () => {reply({Correct: true, FirstSolve: true, Practice: false, Lab: completedLab});});
        expect(client.getQueryData(labKey("e", runningLab.ID))).toEqual(runningLab);
        expect(client.getQueryData<OwnBoard>(key)!.Challenges.map(item => !!item.SolvedAt)).toEqual([false, false, false]);
    });
});

describe("solved task dialog", () => {
    it("shows the solved panel with points, hint penalty, who and when, and no answer form", () => {
        renderModal({...base, SolvedAt: "2026-10-01T11:52:00Z", AwardedPoints: 80, HintPenalty: 20, SolvedBy: {UserID: uuid(7), Name: "Тест Учасник01"}});
        const panel = screen.getByText("Розвʼязано", {selector: "b"}).closest("[role=status]") as HTMLElement;
        expect(within(panel).getByText("80 з 100 · −20 за підказку")).toBeTruthy();
        expect(panel.textContent).toContain("Тест Учасник01, ");
        expect(screen.queryByLabelText("Прапор")).toBeNull();
        expect(screen.queryByRole("button", {name: "Надіслати"})).toBeNull();
        expect(screen.getByRole("tab", {name: /^Розвʼязання/})).toBeTruthy();
    });

    it("without a hint penalty shows just the awarded points", () => {
        renderModal({...base, SolvedAt: "2026-10-01T11:52:00Z"});
        expect(screen.getByText("+100")).toBeTruthy();
    });

    it("a practice solve says so and awards nothing", () => {
        renderModal({...base, Practice: true});
        expect(screen.getByText("Розвʼязано (практика, без балів)")).toBeTruthy();
        expect(screen.queryByText(/^\+\d/)).toBeNull();
        expect(screen.queryByRole("button", {name: "Надіслати"})).toBeNull();
    });
});

describe("a correct answer turns the card solved at once", () => {
    function group(n: number, extra: Partial<OwnChallenge> = {}) {
        return challengeSchema.parse({...base, ID: uuid(900 + n), EventChallengeID: uuid(n), Snapshot: {name: `Завдання ${n}`, difficulty: "easy"}, Order: n, GroupID: uuid(500), GroupName: "Група", GroupOrder: 1, Hints: [], Files: null, ...extra});
    }
    function Harness({mode}: {mode: "participant" | "moderators"}) {
        const [items, setItems] = useState([group(1), group(2)]);
        return <QueryClientProvider client={new QueryClient()}>
            <Board eventID="e" mode={mode} challenges={items} teamMode finished={false} showDifficulty showHints onRefresh={noop}
                onSolved={id => setItems(current => markSolved(current, id, "2026-10-01T11:52:00Z"))} />
        </QueryClientProvider>;
    }
    const send = async () => {
        fireEvent.change(screen.getByLabelText("Прапор"), {target: {value: "ICE{ok}"}});
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Надіслати"}));});
    };

    it("participant: the card is solved and the counters move without a refresh", async () => {
        api.submit.mockResolvedValue({Correct: true, FirstSolve: false, Practice: false});
        render(<Harness mode="participant" />);
        fireEvent.click(screen.getByRole("button", {name: /^Завдання 1/}));
        await send();
        // the default «Відкриті» filter drops it from the grid; «Усі» shows it solved
        fireEvent.click(within(screen.getByRole("group", {name: "Статус"})).getByRole("button", {name: "Усі"}));
        const card = document.querySelector(`[data-challenge-id="${uuid(1)}"]`)!;
        expect(card.classList.contains("is-solved")).toBe(true);
        expect(document.querySelector(`[data-challenge-id="${uuid(2)}"]`)!.classList.contains("is-solved")).toBe(false);
        expect(screen.getAllByText("1 / 2").length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", {name: "Надіслати"})).toBeNull();
    });

    it("moderators' view does the same", async () => {
        api.moderator.mockResolvedValue({Correct: true});
        render(<Harness mode="moderators" />);
        fireEvent.click(screen.getByRole("button", {name: /^Завдання 2/}));
        await send();
        fireEvent.click(within(screen.getByRole("group", {name: "Статус"})).getByRole("button", {name: "Усі"}));
        expect(document.querySelector(`[data-challenge-id="${uuid(2)}"]`)!.classList.contains("is-solved")).toBe(true);
        expect(screen.getAllByText("1 / 2").length).toBeGreaterThan(0);
    });
});
