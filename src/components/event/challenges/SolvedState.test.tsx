// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState} from "react";
import {challengeSchema, type OwnChallenge} from "@/api/participantChallenges";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {markSolved} from "./challengeBoardModel";

const api = vi.hoisted(() => ({submit: vi.fn(), moderator: vi.fn()}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}}), EventVpnProvider: ({children}: {children: React.ReactNode}) => children}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/moderatorsBoard", async importOriginal => ({...await importOriginal<typeof import("@/api/moderatorsBoard")>(), submitModeratorFlag: (...args: unknown[]) => api.moderator(...args)}));
vi.mock("@/api/participantChallenges", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/participantChallenges")>(),
    getOwnChallengeLab: () => new Promise(() => {}),
    submitChallenge: (...args: unknown[]) => api.submit(...args),
}));

const {ChallengeModal} = await import("./ChallengeModal");
const {ChallengeTile} = await import("./ChallengeTile");
const {Board} = await import("./ChallengesBoard");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); api.submit.mockReset(); api.moderator.mockReset(); window.history.replaceState(null, "", "/challenges");});

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

describe("solved task dialog", () => {
    it("shows the solved panel with points, hint penalty, who and when, and no answer form", () => {
        renderModal({...base, SolvedAt: "2026-10-01T11:52:00Z", AwardedPoints: 80, SolvedBy: "Тест Учасник01"});
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
