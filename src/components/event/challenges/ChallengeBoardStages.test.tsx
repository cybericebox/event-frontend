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
const status = (label: string) => within(screen.getByRole("group", {name: "Статус"})).getByRole("button", {name: label});

describe("the board filters", () => {
    const tasks = [task(1, 1), task(2, 1, {StageID: open.ID}), task(3, 2, {StageID: closed.ID, Closed: true}), task(4, 2, {StageID: closed.ID, Closed: true, SolvedAt: "2026-10-01T09:00:00Z"})];

    it("defaults to «Усі»; «Відкриті» narrows to open tasks. One row of status segments, no «Активні» toggle", () => {
        renderBoard(tasks, [closed, open]);
        expect(status("Усі").getAttribute("aria-pressed")).toBe("true");
        expect(names()).toEqual(["Завдання 1", "Завдання 2", "Завдання 3", "Завдання 4"]);
        fireEvent.click(status("Відкриті"));
        expect(within(screen.getByRole("group", {name: "Статус"})).getAllByRole("button").map(b => b.textContent)).toEqual(["Відкриті", "Розвʼязані", "Закриті", "Усі"]);
        expect(screen.queryByRole("group", {name: "Показати"})).toBeNull();
        expect(names()).toEqual(["Завдання 1", "Завдання 2"]);
        // the group with nothing to show vanishes
        expect(screen.queryByRole("region", {name: "Група 2"})).toBeNull();
        expect(screen.getByRole("region", {name: "Група 1"})).toBeTruthy();
    });

    it("«Закриті» shows the closed stage's tasks, «Усі» everything, and the choice lives in the URL", () => {
        renderBoard(tasks, [closed, open]);
        fireEvent.click(status("Закриті"));
        expect(names()).toEqual(["Завдання 3"]);
        expect(window.location.search).toContain("status=closed");
        fireEvent.click(status("Усі"));
        expect(names()).toEqual(["Завдання 1", "Завдання 2", "Завдання 3", "Завдання 4"]);
        expect(screen.getAllByRole("img", { name: "закрито" }).length).toBe(2);
        expect(window.location.search).not.toContain("status");
        fireEvent.click(status("Відкриті"));
        expect(window.location.search).toContain("status=open");
    });

    it("starts from the URL: a stored link opens the same view", () => {
        window.history.replaceState(null, "", "/challenges?status=closed");
        renderBoard(tasks, [closed, open]);
        expect(names()).toEqual(["Завдання 3"]);
    });

    it("hides the stage filter on an event without stages", () => {
        renderBoard([task(1, 1), task(2, 1)], []);
        expect(screen.queryByRole("button", {name: "Етап"})).toBeNull();
        expect(status("Усі")).toBeTruthy();
        expect(names()).toEqual(["Завдання 1", "Завдання 2"]);
    });

    it("during a break with nothing active shows the break message in the centered empty state, and «Усі» still works", () => {
        renderBoard([task(3, 2, {StageID: closed.ID, Closed: true})], [closed], "2026-10-01T10:30:00Z");
        fireEvent.click(status("Відкриті"));
        expect(screen.getByText(/^Перерва до \d{2}:\d{2}\. Завдання наступного етапу зʼявляться після її завершення\.$/)).toBeTruthy();
        expect(document.querySelector("[data-empty-state]")).toBeTruthy();
        fireEvent.click(status("Усі"));
        expect(names()).toEqual(["Завдання 3"]);
    });

    it("an empty filter result says so and offers a reset", () => {
        renderBoard(tasks, [closed, open]);
        window.history.replaceState(null, "", "/challenges?status=solved&stage=" + open.ID);
        cleanup();
        renderBoard(tasks, [closed, open]);
        expect(screen.getByText("За цими фільтрами завдань немає")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Скинути фільтри"}));
        expect(names()).toEqual(["Завдання 1", "Завдання 2", "Завдання 3", "Завдання 4"]);
    });
});


it("keeps returnable ended-stage history in all/closed views and excludes it from open despite an unresolved ready Lab", () => {
    const ended = task(7, 1, {StageID: closed.ID, Closed: false});
    const solvedHistory = task(8, 1, {StageID: closed.ID, Closed: false, SolvedAt: "2026-10-01T09:00:00Z", AwardedPoints: 37});
    renderBoard([ended, solvedHistory], [closed]);
    expect(names()).toEqual(["Завдання 7", "Завдання 8"]);
    fireEvent.click(status("Відкриті")); expect(names()).toEqual([]);
    fireEvent.click(status("Закриті")); expect(names()).toEqual(["Завдання 7"]);
    fireEvent.click(status("Розвʼязані")); expect(names()).toEqual(["Завдання 8"]);
    fireEvent.click(status("Усі")); expect(names()).toEqual(["Завдання 7", "Завдання 8"]);
});

it("shows Closed only for an actual unsolved closed task and has no task search or view toggle", () => {
    renderBoard([task(1, 1), task(2, 1, {SolvedAt: "2026-10-01T09:00:00Z", Closed: true})], []);
    expect(screen.queryByRole("button", {name: "Закриті"})).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", {name: "Рейка"})).toBeNull();
});
it("reloads the selected group from the URL, ignoring the legacy category parameter", () => {
    window.history.replaceState(null, "", `/challenges?group=${uuid(501)}&category=${uuid(502)}`);
    renderBoard([task(1, 1), task(2, 2)], []);
    expect(names()).toEqual(["Завдання 1"]);
    cleanup(); window.history.replaceState(null, "", `/challenges?category=${uuid(502)}`);
    renderBoard([task(1, 1), task(2, 2)], []);
    expect(names()).toEqual(["Завдання 1", "Завдання 2"]);
});
it("keeps fully solved groups as one quiet line under Open, counting practice as solved", () => {
    renderBoard([task(1, 1, {SolvedAt: "2026-10-01T09:00:00Z", AwardedPoints: 75}), task(2, 1, {Practice: true}), task(3, 2)], []);
    fireEvent.click(status("Відкриті"));
    const done=screen.getByRole("region",{name:"Група 1"});
    expect(done.textContent).toContain("2 / 2"); expect(done.querySelector(".ib-tiles")).toBeNull();
    expect(names()).toEqual(["Завдання 3"]);
});
it("the multi-group menu keeps choices open, searches above its scrolling options and shares repeated URL parameters", async () => {
    renderBoard([task(1,1),task(2,2,{SolvedAt:"2026-10-01T09:00:00Z"}),task(3,3)],[]);
    fireEvent.click(screen.getByRole("button",{name:"Група"}));
    expect(await screen.findByRole("searchbox",{name:"Знайти групу"})).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox",{name:/Група 1/}));
    fireEvent.click(screen.getByRole("checkbox",{name:/Група 2/}));
    expect(screen.getByRole("checkbox",{name:/Група 1/}).getAttribute("aria-checked")).toBe("true");
    expect(new URLSearchParams(window.location.search).getAll("group")).toEqual([uuid(501),uuid(502)]);
    const search=window.location.search;
    cleanup();window.history.replaceState(null,"","/challenges"+search);
    renderBoard([task(1,1),task(2,2),task(3,3)],[]);expect(names()).toEqual(["Завдання 1","Завдання 2"]);
    fireEvent.click(screen.getByRole("button",{name:"Група"}));
    fireEvent.click(await screen.findByRole("button",{name:/Усі групи/}));expect(names()).toEqual(["Завдання 1","Завдання 2","Завдання 3"]);
    cleanup();window.history.replaceState(null,"","/challenges");
    renderBoard(Array.from({length:11},(_,index)=>task(index+1,index+1)),[]);fireEvent.click(screen.getByRole("button",{name:"Група"}));
    const input=await screen.findByRole("searchbox",{name:"Знайти групу"});fireEvent.change(input,{target:{value:"Група 11"}});
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    const option=screen.getByRole("checkbox",{name:/Група 11/});fireEvent.click(option);expect(option.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("searchbox",{name:"Знайти групу"})).toBe(input);
});
