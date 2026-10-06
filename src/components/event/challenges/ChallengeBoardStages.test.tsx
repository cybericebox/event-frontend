// @vitest-environment jsdom
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {challengeSchema, type BoardStage, type OwnChallenge} from "@/api/participantChallenges";

vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}}), EventVpnProvider: ({children}: {children: React.ReactNode}) => children}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));

const {Board} = await import("./ChallengesBoard");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
beforeEach(() => {window.history.replaceState(null, "", "/challenges");});
afterEach(cleanup);

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const open: BoardStage = {ID: uuid(1), Name: "Другий", OpensAt: "2026-10-01T10:00:00Z", ClosesAt: "2026-10-01T12:00:00Z", Returnable: false, State: "open"};
const closed: BoardStage = {ID: uuid(2), Name: "Перший", OpensAt: "2026-10-01T08:00:00Z", ClosesAt: "2026-10-01T10:00:00Z", Returnable: true, State: "closed"};

function task(n: number, group: number, extra: Partial<OwnChallenge> = {}): OwnChallenge {
    return challengeSchema.parse({
        ID: uuid(900 + n), EventChallengeID: uuid(n), Snapshot: {name: `Завдання ${n}`, difficulty: "easy"}, Readiness: 2, SolvedAt: null,
        Points: 100, Order: n, GroupID: uuid(500 + group), GroupName: `Група ${group}`, GroupOrder: group, ...extra,
    });
}

function renderBoard(challenges: OwnChallenge[], stages: BoardStage[], nextOpensAt: string | null = null) {
    return render(<QueryClientProvider client={new QueryClient()}>
        <Board eventID="e" mode="participant" challenges={challenges} stages={stages} nextOpensAt={nextOpensAt} teamMode finished={false} showDifficulty showHints onRefresh={() => {}} />
    </QueryClientProvider>);
}
const names = () => screen.queryAllByRole("button").map(button => button.getAttribute("data-challenge-id") ? button.querySelector(".ib-tile__name")?.textContent : null).filter(Boolean);
const scope = (label: string) => within(screen.getByRole("group", {name: "Показати"})).getByRole("button", {name: label});

describe("the board filters", () => {
    const tasks = [task(1, 1), task(2, 1, {StageID: open.ID}), task(3, 2, {StageID: closed.ID, Closed: true}), task(4, 2, {StageID: closed.ID, Closed: true, SolvedAt: "2026-10-01T09:00:00Z"})];

    it("defaults to «Активні»: the open stage's tasks and the sets without a stage", () => {
        renderBoard(tasks, [closed, open]);
        expect(scope("Активні").getAttribute("aria-pressed")).toBe("true");
        expect(names()).toEqual(["Завдання 1", "Завдання 2"]);
        // the group with nothing to show vanishes
        expect(screen.queryByRole("region", {name: "Група 2"})).toBeNull();
        expect(screen.getByRole("region", {name: "Група 1"})).toBeTruthy();
    });

    it("«Всі» brings the closed stage back, marked «закрито», and keeps the choice in the URL", () => {
        renderBoard(tasks, [closed, open]);
        fireEvent.click(scope("Всі"));
        expect(names()).toEqual(["Завдання 1", "Завдання 2", "Завдання 3", "Завдання 4"]);
        expect(screen.getAllByText("закрито").length).toBe(2);
        expect(window.location.search).toContain("scope=all");
        fireEvent.click(scope("Активні"));
        expect(window.location.search).not.toContain("scope");
    });

    it("starts from the URL: a stored link opens the same view", () => {
        window.history.replaceState(null, "", "/challenges?scope=all&status=closed");
        renderBoard(tasks, [closed, open]);
        expect(names()).toEqual(["Завдання 3"]);
    });

    it("hides the stage filter on an event without stages", () => {
        renderBoard([task(1, 1), task(2, 1)], []);
        expect(screen.queryByRole("button", {name: "Етап"})).toBeNull();
        expect(screen.getByRole("button", {name: "Статус"})).toBeTruthy();
        expect(names()).toEqual(["Завдання 1", "Завдання 2"]);
    });

    it("during a break with nothing active shows the break message in the centered empty state, and «Всі» still works", () => {
        renderBoard([task(3, 2, {StageID: closed.ID, Closed: true})], [closed], "2026-10-01T10:30:00Z");
        expect(screen.getByText(/^Перерва до \d{2}:\d{2}\. Завдання наступного етапу зʼявляться після її завершення\.$/)).toBeTruthy();
        expect(document.querySelector("[data-empty-state]")).toBeTruthy();
        fireEvent.click(scope("Всі"));
        expect(names()).toEqual(["Завдання 3"]);
    });

    it("an empty filter result says so and offers a reset", () => {
        renderBoard(tasks, [closed, open]);
        window.history.replaceState(null, "", "/challenges?status=solved");
        cleanup();
        renderBoard(tasks, [closed, open]);
        expect(screen.getByText("За цими фільтрами завдань немає")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Скинути фільтри"}));
        expect(names()).toEqual(["Завдання 1", "Завдання 2"]);
    });
});
