// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ParticipantChallengeError, type ChallengeSolve} from "@/api/participantChallenges";

const load = vi.fn();
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), getChallengeSolves: (...args: unknown[]) => load(...args)}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));

const {ChallengeSolvesTab, SOLVE_ROW_HEIGHT, solvesWindow} = await import("./ChallengeSolvesTab");

// The observers the tab created; a test fires one to simulate the sentinel scrolling into view.
const observers: {callback: IntersectionObserverCallback; target: Element | null}[] = [];
beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("IntersectionObserver", class {
        entry: {callback: IntersectionObserverCallback; target: Element | null};
        constructor(callback: IntersectionObserverCallback) { this.entry = {callback, target: null}; observers.push(this.entry); }
        observe(target: Element) { this.entry.target = target; }
        disconnect() {}
        unobserve() {}
    });
});
afterEach(() => { cleanup(); load.mockReset(); vi.unstubAllGlobals(); });

const solve = (name: string, extra: Partial<ChallengeSolve> = {}): ChallengeSolve => ({TeamName: name, SolvedAt: "2026-01-01T10:00:00Z", Own: false, FirstBlood: false, ...extra});

function view(moderators = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ChallengeSolvesTab eventID="e1" challengeID="c1" moderators={moderators} enabled /></QueryClientProvider>);
}

describe("ChallengeSolvesTab", () => {
    it("lists the first page in delivered order with first blood, own row and the exact time", async () => {
        load.mockResolvedValue({Total: 3, Items: [solve("Альфа", {FirstBlood: true}), solve("Бета", {Own: true}), solve("Гамма")], NextCursor: null});
        view();
        expect(await screen.findByText("Альфа")).toBeTruthy();
        const rows = screen.getAllByRole("listitem");
        expect(rows.map(row => row.querySelector(".ib-solvers__name span")?.textContent)).toEqual(["Альфа", "Бета", "Гамма"]);
        expect(rows[0].textContent).toContain("Перша кров");
        expect(rows[1].className).toContain("is-own");
        expect(rows[1].textContent).toContain("Ви");
        expect(rows[0].querySelector("time")?.getAttribute("datetime")).toBe("2026-01-01T10:00:00Z");
        expect(rows[0].querySelector('[role="tooltip"]')?.textContent).toMatch(/2026/);
        expect(load).toHaveBeenCalledWith("e1", "c1", null, false);
    });

    it("loads the next page with the cursor when the end of the list scrolls into view", async () => {
        load.mockResolvedValueOnce({Total: 2, Items: [solve("Альфа")], NextCursor: "11111111-1111-4111-8111-111111111111"});
        load.mockResolvedValueOnce({Total: 2, Items: [solve("Бета")], NextCursor: null});
        view();
        await screen.findByText("Альфа");
        await waitFor(() => expect(observers.some(entry => entry.target)).toBe(true));
        const entry = observers.find(item => item.target)!;
        act(() => entry.callback([{isIntersecting: true} as IntersectionObserverEntry], {} as IntersectionObserver));
        expect(await screen.findByText("Бета")).toBeTruthy();
        expect(load).toHaveBeenLastCalledWith("e1", "c1", "11111111-1111-4111-8111-111111111111", false);
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("windows a long list to the visible rows", () => {
        expect(solvesWindow(1000, 0)).toEqual({start: 0, end: 14});
        const middle = solvesWindow(1000, SOLVE_ROW_HEIGHT * 500);
        expect(middle.start).toBeGreaterThan(400);
        expect(middle.end - middle.start).toBeLessThan(30);
        expect(solvesWindow(5, 0)).toEqual({start: 0, end: 5});
    });

    it("renders only the window of a long list", async () => {
        load.mockResolvedValue({Total: 200, Items: Array.from({length: 200}, (_, index) => solve(`Команда ${index}`)), NextCursor: null});
        view();
        await screen.findByText("Команда 0");
        expect(screen.getAllByRole("listitem").length).toBeLessThan(30);
        expect(screen.queryByText("Команда 150")).toBeNull();
        fireEvent.scroll(document.querySelector(".ib-solvers__scroll")!, {target: {scrollTop: SOLVE_ROW_HEIGHT * 150}});
        expect(await screen.findByText("Команда 150")).toBeTruthy();
    });

    it("shows the empty state when nobody solved it", async () => {
        load.mockResolvedValue({Total: 0, Items: [], NextCursor: null});
        view();
        expect(await screen.findByText("Ще ніхто не розвʼязав. Станьте першими.")).toBeTruthy();
        expect(document.querySelector("[data-empty-state]")).toBeTruthy();
    });

    it("shows the load error with a retry", async () => {
        load.mockRejectedValueOnce(new ParticipantChallengeError(500));
        load.mockResolvedValueOnce({Total: 1, Items: [solve("Альфа")], NextCursor: null});
        view();
        expect(await screen.findByText("Список рішень недоступний")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"}));
        expect(await screen.findByText("Альфа")).toBeTruthy();
    });

    it("says why the list is closed when the results are hidden", async () => {
        load.mockRejectedValue(new ParticipantChallengeError(403, 1213));
        view();
        expect(await screen.findByText("Список розв’язань приховано організатором")).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Спробувати ще раз"})).toBeNull();
        expect(document.querySelector("[data-empty-state]")).toBeTruthy();
    });

    it("reads the organizer preview list on the moderators board", async () => {
        load.mockResolvedValue({Total: 1, Items: [solve("Модератори", {Own: true})], NextCursor: null});
        view(true);
        await screen.findByText("Модератори");
        expect(load).toHaveBeenCalledWith("e1", "c1", null, true);
    });
});
