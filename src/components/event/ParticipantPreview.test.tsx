// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://event.test/"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {readPreviewCookie} from "@/utils/previewCookie";
import {ParticipantPreviewProvider, ParticipantPreviewEntry, previewAnswerFile, useParticipantPreview} from "./ParticipantPreview";

const api = vi.hoisted(() => ({pathname: "/join", reset: vi.fn(), board: vi.fn(), start: vi.fn(), stop: vi.fn(), toastError: vi.fn(), push: vi.fn(), access: vi.fn(async () => ({CanManage: true}))}));
vi.mock("@/api/participantPreview", () => ({
    resetPreviewRuns: api.reset, getPreviewBoard: api.board, startPreviewRun: api.start, stopPreviewRun: api.stop,
    previewBoardKey: (eventID: string | undefined) => ["event-participant-preview-board", eventID],
}));
vi.mock("react-hot-toast", () => ({default: {error: api.toastError}, toast: {error: api.toastError}}));
vi.mock("next/navigation", () => ({usePathname: () => api.pathname, useRouter: () => ({push: api.push})}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: async () => ({ID: "user-1"})}));
vi.mock("@/api/manage", () => ({getManageAccess: api.access, getManageConfig: async () => ({ScoreboardVisibility: 1})}));
const storageKey = "event-participant-preview-v1";
const state = {eventID: "event-1", userID: "user-1", status: 2, outcome: "approved", answers: {school: "School"}, team: null};
function Status() {
    const preview = useParticipantPreview("event-1");
    return <><output data-testid="state">{preview.active ? JSON.stringify(preview.state) : "inactive"}</output><button onClick={() => preview.update({status: 2, answers: {school: "Edited"}})}>Update local answers</button></>;
}
function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
    client.setQueryData(["event-current-user"], {ID: "user-1"});
    client.setQueryData(["event-management-access", "event-1"], {CanManage: true});
    const tree = () => <QueryClientProvider client={client}><ParticipantPreviewProvider><ParticipantPreviewEntry eventID="event-1" /><Status /></ParticipantPreviewProvider></QueryClientProvider>;
    const mounted = render(tree());
    return {...mounted, client, refreshRoute: () => mounted.rerender(tree())};
}
async function openMenu() {
    fireEvent.pointerDown(screen.getByRole("button", {name: "Дії тестового режиму"}), {button: 0, ctrlKey: false});
    return screen.findByRole("menu");
}

beforeEach(() => {document.cookie = "cib_participant_preview=; Path=/; Max-Age=0"; sessionStorage.clear(); api.pathname = "/join"; vi.clearAllMocks(); api.board.mockReset(); api.start.mockReset(); api.stop.mockReset(); api.reset.mockResolvedValue(undefined); api.access.mockResolvedValue({CanManage: true});});
afterEach(cleanup);

it("persists local state, clears owned server runs before resetting registration, and exits to management", async () => {
    const first = view();
    fireEvent.click(screen.getByRole("button", {name: "Тестувати як учасник"}));
    fireEvent.click(screen.getByRole("button", {name: "Update local answers"}));
    expect(JSON.parse(sessionStorage.getItem(storageKey)!).answers).toEqual({school: "Edited"});
    first.unmount();
    view();
    expect(screen.getByTestId("state").textContent).toContain("Edited");
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Почати спочатку"}));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(storageKey)!)).toMatchObject({status: 0, team: null, answers: {}}));
    expect(api.reset).toHaveBeenCalledWith("event-1");
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Вийти з тестування"}));
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(screen.getByTestId("state").textContent).toBe("inactive");
    expect(api.push).toHaveBeenLastCalledWith("/manage");
});

it("does not replace auth, join status or own-team caches with simulated state", () => {
    const {client} = view();
    client.setQueryData(["event-join-status", "event-1"], 0);
    client.setQueryData(["event-own-team", "event-1"], null);
    fireEvent.click(screen.getByRole("button", {name: "Тестувати як учасник"}));
    fireEvent.click(screen.getByRole("button", {name: "Update local answers"}));
    expect(client.getQueryData(["event-current-user"])).toEqual({ID: "user-1"});
    expect(client.getQueryData(["event-join-status", "event-1"])).toBe(0);
    expect(client.getQueryData(["event-own-team", "event-1"])).toBeNull();
});

it("waits for owned cleanup, keeps other actions enabled, and clears only preview caches", async () => {
    let finish!: () => void;
    api.reset.mockReturnValue(new Promise<void>(resolve => {finish = resolve;}));
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    client.setQueryData(["event-participant-preview-board", "event-1"], {Challenges: ["old"]});
    client.setQueryData(["event-own-challenges", "event-1"], {Challenges: ["competition"]});
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Почати спочатку"}));
    expect(screen.getByRole("menuitem", {name: "Почати спочатку"}).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("menuitem", {name: "Вийти з тестування"}).getAttribute("aria-disabled")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(storageKey)!).status).toBe(2);
    await act(async () => {finish();});
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(storageKey)!).status).toBe(0));
    expect(client.getQueryData(["event-participant-preview-board", "event-1"])).toBeUndefined();
    expect(client.getQueryData(["event-own-challenges", "event-1"])).toEqual({Challenges: ["competition"]});
});

it("preserves browser state and progress if owned cleanup fails", async () => {
    api.reset.mockRejectedValue(new Error("cleanup failed"));
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    client.setQueryData(["event-participant-preview-board", "event-1"], {Challenges: ["old"]});
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Почати спочатку"}));
    await waitFor(() => expect(api.toastError).toHaveBeenCalled());
    expect(JSON.parse(sessionStorage.getItem(storageKey)!)).toEqual(state);
    expect(client.getQueryData(["event-participant-preview-board", "event-1"])).toEqual({Challenges: ["old"]});
});

it("hides saved test state when the account changes or management rights are revoked", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    expect(screen.getByTestId("state").textContent).toContain("School");
    act(() => client.setQueryData(["event-management-access", "event-1"], {CanManage: false}));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
    act(() => {client.setQueryData(["event-management-access", "event-1"], {CanManage: true}); client.setQueryData(["event-current-user"], {ID: "another-user"});});
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
});

it.each(["not-json", JSON.stringify({...state, outcome: "wrong"}), JSON.stringify({...state, answers: {bad: {anything: 1}}}), JSON.stringify({...state, team: {Name: "Incomplete team"}})])("ignores corrupt saved state safely: %s", raw => {
    sessionStorage.setItem(storageKey, raw);
    view();
    expect(screen.getByTestId("state").textContent).toBe("inactive");
});

it("simulates file answers using metadata without uploading a file", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const result = await previewAnswerFile(new File(["test"], "answer.txt", {type: "text/plain"}));
    expect(result).toMatchObject({name: "answer.txt", size: 4, contentType: "text/plain"});
    expect(result.id).toMatch(/^preview-/);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
});

it("keeps test state saved but disables all simulation hooks inside management routes", () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    const {refreshRoute} = view();
    expect(screen.getByTestId("state").textContent).toContain("School");
    api.pathname = "/manage/participants";
    refreshRoute();
    expect(screen.getByTestId("state").textContent).toBe("inactive");
    expect(sessionStorage.getItem(storageKey)).toContain("School");
    api.pathname = "/participation";
    refreshRoute();
    expect(screen.getByTestId("state").textContent).toContain("School");
});

it("turns off preview after a permission refresh fails even while the old successful access data remains cached", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    expect(screen.getByTestId("state").textContent).toContain("School");
    api.access.mockRejectedValueOnce(new Error("403"));
    await act(async () => {await client.refetchQueries({queryKey: ["event-management-access", "event-1"]});});
    expect(client.getQueryData(["event-management-access", "event-1"])).toEqual({CanManage: true});
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
});

it("collapses preview controls into one title row and a single accessible menu button", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    view();
    const bar = screen.getByRole("region", {name: "Режим тестового учасника"});
    expect(bar.textContent).toBe("Режим тестового учасника");
    expect(within(bar).getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("Почати спочатку")).toBeNull();
    expect(screen.queryByText("Вийти з тестування")).toBeNull();
    const trigger = screen.getByRole("button", {name: "Дії тестового режиму"});
    fireEvent.keyDown(trigger, {key: "Enter"});
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", {name: "Почати спочатку"})).toBeTruthy();
    fireEvent.keyDown(menu, {key: "Escape"});
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
});

it.each([
    ["/join", 2, true],
    ["/participation", 1, true],
    ["/participation", 2, false],
    ["/challenges", 2, false],
    ["/", 0, false],
])("shows registration outcomes only in the relevant context (%s, status %s)", async (pathname, status, relevant) => {
    api.pathname = pathname;
    sessionStorage.setItem(storageKey, JSON.stringify({...state, status, outcome: status === 1 ? "pending" : "approved"}));
    view();
    await openMenu();
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(relevant ? 3 : 0);
    expect(screen.getByRole("menuitem", {name: "Почати спочатку"})).toBeTruthy();
    expect(screen.getByRole("menuitem", {name: "Вийти з тестування"})).toBeTruthy();
});

it("sets the mode cookie when the mode starts and clears it on exit", async () => {
    view();
    expect(readPreviewCookie()).toBeNull();
    fireEvent.click(screen.getByRole("button", {name: "Тестувати як учасник"}));
    expect(readPreviewCookie()).toBe("event-1");
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Вийти з тестування"}));
    expect(readPreviewCookie()).toBeNull();
});

it("initial client state equals the server render: the cookie hint is on before any query answers", () => {
    document.cookie = "cib_participant_preview=event-1; Path=/; Secure";
    const client = new QueryClient();
    function Hint() {return <output data-testid="hint">{String(useParticipantPreview("event-1").hinted)}</output>;}
    const {container} = render(<QueryClientProvider client={client}><ParticipantPreviewProvider serverCookie="event-1"><Hint /></ParticipantPreviewProvider></QueryClientProvider>);
    expect(container.querySelector("[data-testid=hint]")?.textContent).toBe("true");
});

it("drops a stale cookie when no valid mode stands behind it", async () => {
    document.cookie = "cib_participant_preview=event-1; Path=/; Secure";
    view();
    await waitFor(() => expect(readPreviewCookie()).toBeNull());
});

// The test tasks list at once (the board never waits for a schedule); the infrastructure switch only decides whether the
// dynamic tasks' labs run. Off by default: nothing is launched until the staff member asks.
const dynamic = (selection: string, run: string | null = null) => ({PreviewSelectionID: selection, PreviewDynamic: true, PreviewCanStart: true, PreviewRunID: run, Infrastructure: true});
const staticTask = {PreviewSelectionID: "sel-static", PreviewDynamic: false, PreviewCanStart: true, PreviewRunID: null, Infrastructure: false};
const boardOf = (...Challenges: object[]) => ({Challenges, Stages: [], ServerNow: "2026-10-20T10:00:00Z"});

it("offers the infrastructure switch, off by default, and keeps it in the saved state", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    view();
    await openMenu();
    const item = screen.getByRole("menuitemcheckbox", {name: "Запустити інфраструктуру"});
    expect(item.getAttribute("aria-checked")).toBe("false");
    api.board.mockResolvedValue(boardOf());
    fireEvent.click(item);
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(storageKey)!).infra).toBe(true));
});

it("launches only the dynamic tasks without a run once the switch is on, once per task", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({...state, infra: true}));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a"), dynamic("sel-a"), dynamic("sel-b", "run-b"), staticTask));
    api.start.mockResolvedValue({ID: "run-a", SelectionID: "sel-a", Dynamic: true, ExpiresAt: "2026-10-20T11:00:00Z"});
    const {client} = view();
    await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
    expect(api.start).toHaveBeenCalledWith("event-1", "sel-a");
    await waitFor(() => expect((client.getQueryData(["event-participant-preview-board", "event-1"]) as {Challenges: {PreviewSelectionID: string; PreviewRunID: string | null}[]}).Challenges.find(task => task.PreviewSelectionID === "sel-a")!.PreviewRunID).toBe("run-a"));
    // A refetched board where the lease ended must not relaunch it by itself.
    await act(async () => {await client.refetchQueries({queryKey: ["event-participant-preview-board", "event-1"]});});
    expect(api.start).toHaveBeenCalledTimes(1);
});

it("launches nothing while the switch is off, however many dynamic tasks wait", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a")));
    view();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(api.start).not.toHaveBeenCalled();
});

it("tells the user once when a launch fails and does not retry in a loop", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({...state, infra: true}));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a"), dynamic("sel-b")));
    api.start.mockRejectedValue(new Error("no room"));
    const {client} = view();
    await waitFor(() => expect(api.toastError).toHaveBeenCalledTimes(1));
    await act(async () => {await client.refetchQueries({queryKey: ["event-participant-preview-board", "event-1"]});});
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.toastError).toHaveBeenCalledTimes(1);
});

it("ends the running dynamic labs when the switch goes off, shows the work, and keeps static progress", async () => {
    let finish!: () => void;
    sessionStorage.setItem(storageKey, JSON.stringify({...state, infra: true}));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a", "run-a"), dynamic("sel-b"), staticTask));
    api.stop.mockReturnValue(new Promise<void>(resolve => {finish = resolve;}));
    api.start.mockResolvedValue({ID: "run-b", SelectionID: "sel-b", Dynamic: true, ExpiresAt: "2026-10-20T11:00:00Z"});
    view();
    await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
    await openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", {name: "Запустити інфраструктуру"}));
    await waitFor(() => expect(api.stop).toHaveBeenCalled());
    expect(screen.getByRole("menuitemcheckbox", {name: "Зупиняємо інфраструктуру…"}).getAttribute("aria-busy")).toBe("true");
    expect(JSON.parse(sessionStorage.getItem(storageKey)!).infra).toBe(true);
    await act(async () => {finish();});
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(storageKey)!).infra).toBe(false));
    expect(api.stop.mock.calls.map(call => call[1]).sort()).toEqual(["sel-a", "sel-b"]);
    expect(api.reset).not.toHaveBeenCalled();
});

it("keeps the switch on and says so when ending a lab fails", async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({...state, infra: true}));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a", "run-a")));
    api.stop.mockRejectedValue(new Error("cleanup failed"));
    view();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", {name: "Запустити інфраструктуру"}));
    await waitFor(() => expect(api.toastError).toHaveBeenCalled());
    expect(JSON.parse(sessionStorage.getItem(storageKey)!).infra).toBe(true);
});
