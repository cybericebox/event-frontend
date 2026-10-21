// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://event.test/"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useEffect} from "react";
import {readPreviewCookie} from "@/utils/previewCookie";
import {ParticipantPreviewProvider, ParticipantPreviewEntry, previewAnswerFile, useParticipantPreview} from "./ParticipantPreview";

const api = vi.hoisted(() => ({pathname: "/join", reset: vi.fn(), board: vi.fn(), start: vi.fn(), stop: vi.fn(), toastError: vi.fn(), push: vi.fn(), access: vi.fn(async () => ({CanManage: true}))}));
vi.mock("@/api/participantPreview", async () => {
    const {trackPreviewRunStart} = await import("@/api/previewRunLifecycle");
    return ({
    resetPreviewRuns: api.reset, getPreviewBoard: api.board, startPreviewRun: (eventID: string, selectionID: string) => trackPreviewRunStart(eventID, () => api.start(eventID, selectionID)), stopPreviewRun: api.stop,
    previewBoardKey: (eventID: string | undefined) => ["event-participant-preview-board", eventID],
});});
vi.mock("react-hot-toast", () => ({default: {error: api.toastError}, toast: {error: api.toastError}}));
vi.mock("next/navigation", () => ({usePathname: () => api.pathname, useRouter: () => ({push: api.push})}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: async () => ({ID: "user-1"})}));
vi.mock("@/api/manage", () => ({getManageAccess: api.access, getManageConfig: async () => ({ScoreboardVisibility: 1})}));
const storageKey = "event-participant-preview-v1";
const state = {eventID: "event-1", userID: "user-1", status: 2, outcome: "approved", answers: {school: "School"}, team: null};
function Status() {
    const preview = useParticipantPreview("event-1");
    return <><output data-testid="state">{preview.active ? JSON.stringify(preview.state) : "inactive"}</output><button onClick={() => preview.start("event-1")}>Re-enter directly</button><button onClick={() => void preview.exit()}>Exit directly</button><button onClick={() => void preview.reset()}>Reset directly</button><button onClick={() => void preview.setTasks(false)}>Stop directly</button><button onClick={() => preview.update({status: 2, answers: {school: "Edited"}})}>Update local answers</button></>;
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

beforeEach(() => {document.cookie = "cib_participant_preview=; Path=/; Max-Age=0"; localStorage.clear(); sessionStorage.clear(); api.pathname = "/join"; vi.clearAllMocks(); api.board.mockReset(); api.start.mockReset(); api.stop.mockReset(); api.reset.mockResolvedValue(undefined); api.access.mockResolvedValue({CanManage: true});});
afterEach(cleanup);

it("persists local state, clears owned server runs before resetting registration, and exits to management", async () => {
    const first = view();
    fireEvent.click(screen.getByRole("button", {name: "Тестувати як учасник"}));
    fireEvent.click(screen.getByRole("button", {name: "Update local answers"}));
    expect(JSON.parse(localStorage.getItem(storageKey)!).answers).toEqual({school: "Edited"});
    first.unmount();
    view();
    expect(screen.getByTestId("state").textContent).toContain("Edited");
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Почати спочатку"}));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({status: 0, team: null, answers: {}}));
    expect(api.reset).toHaveBeenCalledWith("event-1");
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Вийти з тестування"}));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")).toBeNull());
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

it("serializes owned cleanup actions, keeps local fields enabled, and clears only preview caches", async () => {
    let finish!: () => void;
    api.reset.mockReturnValue(new Promise<void>(resolve => {finish = resolve;}));
    localStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    client.setQueryData(["event-participant-preview-board", "event-1"], {Challenges: ["old"]});
    client.setQueryData(["event-own-challenges", "event-1"], {Challenges: ["competition"]});
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Почати спочатку"}));
    expect(screen.getByRole("menuitem", {name: "Скидаємо тестування…"}).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("menuitem", {name: "Вийти з тестування"}).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Update local answers").closest("button")).toHaveProperty("disabled", false);
    expect(JSON.parse(localStorage.getItem(storageKey)!).status).toBe(2);
    await act(async () => {finish();});
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey)!).status).toBe(0));
    expect(client.getQueryData(["event-participant-preview-board", "event-1"])).toBeUndefined();
    expect(client.getQueryData(["event-own-challenges", "event-1"])).toEqual({Challenges: ["competition"]});
});

it("preserves browser state and progress if owned cleanup fails", async () => {
    api.reset.mockRejectedValue(new Error("cleanup failed"));
    localStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    client.setQueryData(["event-participant-preview-board", "event-1"], {Challenges: ["old"]});
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Почати спочатку"}));
    await waitFor(() => expect(api.toastError).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state);
    expect(client.getQueryData(["event-participant-preview-board", "event-1"])).toEqual({Challenges: ["old"]});
});

it("hides saved test state when the account changes or management rights are revoked", async () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    expect(screen.getByTestId("state").textContent).toContain("School");
    act(() => client.setQueryData(["event-management-access", "event-1"], {CanManage: false}));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
    act(() => {client.setQueryData(["event-management-access", "event-1"], {CanManage: true}); client.setQueryData(["event-current-user"], {ID: "another-user"});});
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
});

it.each(["not-json", JSON.stringify({...state, outcome: "wrong"}), JSON.stringify({...state, answers: {bad: {anything: 1}}}), JSON.stringify({...state, team: {Name: "Incomplete team"}})])("ignores corrupt saved state safely: %s", raw => {
    localStorage.setItem(storageKey, raw);
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
    localStorage.setItem(storageKey, JSON.stringify(state));
    const {refreshRoute} = view();
    expect(screen.getByTestId("state").textContent).toContain("School");
    api.pathname = "/manage/participants";
    refreshRoute();
    expect(screen.getByTestId("state").textContent).toBe("inactive");
    expect(localStorage.getItem(storageKey)).toContain("School");
    api.pathname = "/participation";
    refreshRoute();
    expect(screen.getByTestId("state").textContent).toContain("School");
});

it("turns off preview after a permission refresh fails even while the old successful access data remains cached", async () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    const {client} = view();
    expect(screen.getByTestId("state").textContent).toContain("School");
    api.access.mockRejectedValueOnce(new Error("403"));
    await act(async () => {await client.refetchQueries({queryKey: ["event-management-access", "event-1"]});});
    expect(client.getQueryData(["event-management-access", "event-1"])).toEqual({CanManage: true});
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
});

it("collapses preview controls into one title row and a single accessible menu button", async () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
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
    localStorage.setItem(storageKey, JSON.stringify({...state, status, outcome: status === 1 ? "pending" : "approved"}));
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
    await waitFor(() => expect(readPreviewCookie()).toBeNull());
});

it("initial client state equals the server render: the cookie hint is on before any query answers", () => {
    document.cookie = "cib_participant_preview=event-1; Path=/; Secure";
    const client = new QueryClient();
    function Hint() {return <output data-testid="hint">{String(useParticipantPreview("event-1").hinted)}</output>;}
    const {container} = render(<QueryClientProvider client={client}><ParticipantPreviewProvider serverCookie="event-1"><Hint /></ParticipantPreviewProvider></QueryClientProvider>);
    expect(container.querySelector("[data-testid=hint]")?.textContent).toBe("true");
});

it("preserves the mode cookie when no tab state is available without activating preview", async () => {
    document.cookie = "cib_participant_preview=event-1; Path=/; Secure";
    view();
    expect(screen.getByTestId("state").textContent).toBe("inactive");
    expect(readPreviewCookie()).toBe("event-1");
});

// One switch, «Показати завдання», default off: on shows the test task board and launches the dynamic tasks' labs; off ends them.
const dynamic = (selection: string, run: string | null = null) => ({PreviewSelectionID: selection, PreviewDynamic: true, PreviewCanStart: true, PreviewRunID: run, Infrastructure: true});
const staticTask = {PreviewSelectionID: "sel-static", PreviewDynamic: false, PreviewCanStart: true, PreviewRunID: null, Infrastructure: false};
const boardOf = (...Challenges: object[]) => ({Challenges, Stages: [], ServerNow: "2026-10-20T10:00:00Z"});
const on = {...state, tasks: true};

it("offers one switch, «Показати завдання», off by default, and no separate infrastructure item", async () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    api.board.mockResolvedValue(boardOf());
    view();
    await openMenu();
    const item = screen.getByRole("menuitemcheckbox", {name: "Показати завдання"});
    expect(item.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("menuitemcheckbox", {name: /інфраструктуру/})).toBeNull();
    fireEvent.click(item);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey)!).tasks).toBe(true));
});

it("launches only the dynamic tasks without a run once the switch is on, once per task", async () => {
    localStorage.setItem(storageKey, JSON.stringify(on));
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
    localStorage.setItem(storageKey, JSON.stringify(state));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a")));
    view();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(api.start).not.toHaveBeenCalled();
});

it("tells the user once when a launch fails and does not retry in a loop", async () => {
    localStorage.setItem(storageKey, JSON.stringify(on));
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
    localStorage.setItem(storageKey, JSON.stringify(on));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a", "run-a"), dynamic("sel-b"), staticTask));
    api.stop.mockReturnValue(new Promise<void>(resolve => {finish = resolve;}));
    api.start.mockResolvedValue({ID: "run-b", SelectionID: "sel-b", Dynamic: true, ExpiresAt: "2026-10-20T11:00:00Z"});
    view();
    await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
    await openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", {name: "Показати завдання"}));
    await waitFor(() => expect(api.stop).toHaveBeenCalled());
    expect(screen.getByRole("menuitemcheckbox", {name: "Зупиняємо інфраструктуру…"}).getAttribute("aria-busy")).toBe("true");
    expect(JSON.parse(localStorage.getItem(storageKey)!).tasks).toBe(true);
    await act(async () => {finish();});
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey)!).tasks).toBe(false));
    expect(api.stop.mock.calls.map(call => call[1]).sort()).toEqual(["sel-a", "sel-b"]);
    expect(api.reset).not.toHaveBeenCalled();
});

it("keeps the switch on and says so when ending a lab fails", async () => {
    localStorage.setItem(storageKey, JSON.stringify(on));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a", "run-a")));
    api.stop.mockRejectedValue(new Error("cleanup failed"));
    view();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", {name: "Показати завдання"}));
    await waitFor(() => expect(api.toastError).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem(storageKey)!).tasks).toBe(true);
});

it("entering the test mode and starting over both leave the switch off", async () => {
    localStorage.setItem(storageKey, JSON.stringify(on));
    view();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", {name: "Почати спочатку"}));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey)!).tasks).toBe(false));
});

it.each([true,false])("ends every owned preview run before exiting even when tasks=%s", async tasks => {
    let finish!: () => void;
    api.reset.mockImplementation(() => new Promise<void>(resolve => {finish = resolve;}));
    localStorage.setItem(storageKey, JSON.stringify({...state,tasks}));
    api.board.mockResolvedValue(boardOf(dynamic("sel-active","run-unsolved")));
    const {client} = view();
    client.setQueryData(["event-challenge-lab","preview","event-1","task"], {Ready:true});
    client.setQueryData(["event-own-challenges","event-1"], {Challenges:["competition"]});
    client.setQueryData(["event-current-user"], {ID:"user-1"});
    await openMenu(); fireEvent.click(screen.getByRole("menuitem", {name:"Вийти з тестування"}));
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith("event-1"));
    expect(localStorage.getItem(storageKey)).not.toBeNull(); expect(api.push).not.toHaveBeenCalledWith("/manage");
    const busy = screen.getByRole("menuitem", {name:"Виходимо з тестування…"});
    expect(busy.getAttribute("aria-busy")).toBe("true"); expect(busy.querySelector(".ib-busy-mark")).toBeTruthy();
    fireEvent.click(busy); expect(api.reset).toHaveBeenCalledTimes(1);
    await act(async () => {finish();});
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")).toBeNull());
    expect(readPreviewCookie()).toBeNull(); expect(api.push).toHaveBeenLastCalledWith("/manage");
    expect(client.getQueryData(["event-challenge-lab","preview","event-1","task"])).toBeUndefined();
    expect(client.getQueryData(["event-own-challenges","event-1"])).toEqual({Challenges:["competition"]});
    expect(client.getQueryData(["event-current-user"])).toEqual({ID:"user-1"});
});
it("retains test mode and progress on failed exit cleanup and lets the same action retry", async () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    api.reset.mockRejectedValueOnce(new Error("cleanup refused"));
    view(); await openMenu(); fireEvent.click(screen.getByRole("menuitem", {name:"Вийти з тестування"}));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Не вдалося завершити тестування. Спробуйте ще раз.");
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state); expect(api.push).not.toHaveBeenCalledWith("/manage");
    fireEvent.click(screen.getByRole("menuitem", {name:"Вийти з тестування"}));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")).toBeNull()); expect(api.reset).toHaveBeenCalledTimes(2);
});

it.each(["exit","reset"])("fences delayed starts before final %s cleanup and never starts the next queued lab", async kind => {
    let launch!: (value: unknown) => void;
    const order: string[] = [];
    api.start.mockImplementation(() => new Promise(resolve => {launch = value => {order.push("started"); resolve(value);};}));
    api.reset.mockImplementation(async () => {order.push("cleanup");});
    localStorage.setItem(storageKey, JSON.stringify(on));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a"),dynamic("sel-b")));
    view(); await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
    await openMenu(); fireEvent.click(screen.getByRole("menuitem", {name:kind==="exit"?"Вийти з тестування":"Почати спочатку"}));
    expect(api.reset).not.toHaveBeenCalled();
    await act(async () => {launch({ID:"late-run", ExpiresAt:null});});
    await waitFor(() => expect(api.reset).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["started","cleanup"]); expect(api.start).toHaveBeenCalledTimes(1);
    if (kind==="exit") await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")).toBeNull());
    else await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey)!).tasks).toBe(false));
});

it("blocks same-account re-entry while the old exit is pending", async () => {
    let finish!:()=>void; api.reset.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
    localStorage.setItem(storageKey,JSON.stringify(state)); const mounted=view();
    fireEvent.click(screen.getByText("Exit directly")); await waitFor(()=>expect(api.reset).toHaveBeenCalledOnce());
    api.pathname="/manage"; mounted.refreshRoute();
    expect(screen.getByRole("button",{name:"Виходимо з тестування…"})).toHaveProperty("disabled",true);
    fireEvent.click(screen.getByText("Re-enter directly"));
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state); expect(api.push).not.toHaveBeenCalledWith("/");
    await act(async()=>{finish();}); await waitFor(()=>expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")).toBeNull());
});
it.each(["Exit","Reset","Stop"])("fences %s completion against a new instance for the same account/event", async kind=>{
    let finish!:()=>void;
    api.reset.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;})); api.stop.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
    localStorage.setItem(storageKey,JSON.stringify({...state,tasks:kind==="Stop"}));
    api.board.mockResolvedValue(boardOf(dynamic("sel-a","run-a"))); const {client}=view();
    fireEvent.click(screen.getByText(`${kind} directly`)); await waitFor(()=>expect(kind==="Stop"?api.stop:api.reset).toHaveBeenCalledOnce());
    const fresh={...state,tasks:true,sessionID:"fresh-instance",answers:{fresh:"progress"}};
    act(()=>{localStorage.setItem(storageKey,JSON.stringify(fresh));window.dispatchEvent(new Event("event-participant-preview-change"));client.setQueryData(["event-participant-preview-board","event-1"],boardOf(dynamic("sel-a","new-run")));});
    await act(async()=>{finish();});
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(fresh);
    expect(client.getQueryData(["event-participant-preview-board","event-1"])).toEqual(boardOf(dynamic("sel-a","new-run"))); expect(api.push).not.toHaveBeenCalled();
});
it.each(["Exit","Reset","Stop"])("does not dispatch delayed %s cleanup after logout/account replacement during a start drain", async kind=>{
    for(const actor of [null,"other-user","bounce"]){
        let launch!:(value:unknown)=>void; api.start.mockImplementation(()=>new Promise(resolve=>{launch=resolve;}));
        localStorage.setItem(storageKey,JSON.stringify(on)); api.board.mockResolvedValue(boardOf(dynamic("sel-a"),dynamic("sel-b")));
        const mounted=view(); await waitFor(()=>expect(api.start).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByText(`${kind} directly`));
        act(()=>{if(actor===null) mounted.client.clear(); else {mounted.client.setQueryData(["event-current-user"],{ID:"other-user"});if(actor==="bounce")mounted.client.setQueryData(["event-current-user"],{ID:"user-1"});}});
        await act(async()=>{launch({ID:"late-run",ExpiresAt:null});});
        expect(api.reset).not.toHaveBeenCalled();expect(api.stop).not.toHaveBeenCalled(); expect(api.start).toHaveBeenCalledOnce();expect(api.push).not.toHaveBeenCalled();
        mounted.unmount();api.start.mockClear();api.reset.mockClear();api.stop.mockClear();
    }
});
it.each(["Exit","Reset","Stop"])("fences a manual task start drain against account change before %s cleanup", async kind=>{
    let launch!:(value:unknown)=>void;api.start.mockImplementation(()=>new Promise(resolve=>{launch=resolve;}));
    localStorage.setItem(storageKey,JSON.stringify(state));const {client}=view();
    const {startPreviewRun}=await import("@/api/participantPreview");const pending=startPreviewRun("event-1","manual");await waitFor(()=>expect(api.start).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText(`${kind} directly`));act(()=>client.setQueryData(["event-current-user"],{ID:"other-user"}));
    await act(async()=>{launch({ID:"manual-late",ExpiresAt:null});await pending;});expect(api.reset).not.toHaveBeenCalled();expect(api.push).not.toHaveBeenCalled();
});

it.each(["Exit","Reset","Stop"])("does not mutate replacement-account caches after a dispatched %s cleanup settles", async kind=>{
    let finish!:()=>void;api.reset.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));api.stop.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
    localStorage.setItem(storageKey,JSON.stringify({...state,tasks:kind==="Stop"}));api.board.mockResolvedValue(boardOf(dynamic("sel-a","old-run")));const {client}=view();
    fireEvent.click(screen.getByText(`${kind} directly`));await waitFor(()=>expect(kind==="Stop"?api.stop:api.reset).toHaveBeenCalledOnce());
    const replacement=boardOf(dynamic("sel-a","other-account-run"));
    act(()=>{client.setQueryData(["event-current-user"],{ID:"other-user"});client.setQueryData(["event-participant-preview-board","event-1"],replacement);client.setQueryData(["event-challenge-lab","preview","event-1","task"],{actor:"other-user"});});
    await act(async()=>{finish();});
    expect(client.getQueryData(["event-participant-preview-board","event-1"])).toEqual(replacement);
    expect(client.getQueryData(["event-challenge-lab","preview","event-1","task"])).toEqual({actor:"other-user"});
    expect(JSON.parse(localStorage.getItem(storageKey)!).answers).toEqual(state.answers);expect(api.push).not.toHaveBeenCalled();
});
it.each(["Exit","Reset"])("rechecks the preview instance after asynchronous query cancellation during %s", async kind=>{
    let finish!:()=>void;localStorage.setItem(storageKey,JSON.stringify(state));const {client}=view();
    const cancel=vi.spyOn(client,"cancelQueries").mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const remove=vi.spyOn(client,"removeQueries");
    fireEvent.click(screen.getByText(`${kind} directly`));await waitFor(()=>expect(cancel).toHaveBeenCalledOnce());
    const fresh={...state,sessionID:"after-cancel",answers:{fresh:"kept"}};
    act(()=>{localStorage.setItem(storageKey,JSON.stringify(fresh));window.dispatchEvent(new Event("event-participant-preview-change"));client.setQueryData(["event-participant-preview-board","event-1"],{fresh:true});});
    await act(async()=>{finish();});
    expect(remove).not.toHaveBeenCalled();expect(client.getQueryData(["event-participant-preview-board","event-1"])).toEqual({fresh:true});
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(fresh);expect(api.push).not.toHaveBeenCalled();cancel.mockRestore();remove.mockRestore();
});
it("checks current authority after an awaited board read before stopping preview labs", async()=>{
    let finish!:(value:unknown)=>void;api.board.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    localStorage.setItem(storageKey,JSON.stringify(state));const {client}=view();fireEvent.click(screen.getByText("Stop directly"));await waitFor(()=>expect(api.board).toHaveBeenCalledOnce());
    act(()=>client.setQueryData(["event-current-user"],{ID:"other-user"}));
    await act(async()=>{finish(boardOf(dynamic("sel-a","old-run")));});expect(api.stop).not.toHaveBeenCalled();expect(api.reset).not.toHaveBeenCalled();expect(api.push).not.toHaveBeenCalled();
});


it("restores the same account's full test state after the tab session disappears", () => {
    const startedAt = "2026-10-20T10:00:00.000Z";
    vi.useFakeTimers({toFake: ["Date"]});
    vi.setSystemTime(new Date(startedAt));
    try {
        const first = view();
        fireEvent.click(screen.getByRole("button", {name: "Тестувати як учасник"}));
        fireEvent.click(screen.getByText("Update local answers"));
        first.unmount();
        sessionStorage.clear();
        const returned = view();
        expect(JSON.parse(screen.getByTestId("state").textContent!)).toMatchObject({userID: "user-1", startedAt, answers: {school: "Edited"}});
        expect(readPreviewCookie()).toBe("event-1");
        returned.unmount();
    } finally {vi.useRealTimers();}
});

it("migrates a legacy tab snapshot durably without inventing its historical start time", () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    const first = view();
    expect(screen.getByTestId("state").textContent).toContain("School");
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state);
    expect(JSON.parse(screen.getByTestId("state").textContent!)).not.toHaveProperty("startedAt");
    first.unmount();
    sessionStorage.clear();
    view();
    expect(screen.getByTestId("state").textContent).toContain("School");
});

it("keeps the saved mode and cookie while another account or revoked permission makes preview inactive", async () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    document.cookie = "cib_participant_preview=event-1; Path=/; Secure";
    const {client} = view();
    act(() => client.setQueryData(["event-management-access", "event-1"], {CanManage: false}));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
    expect(readPreviewCookie()).toBe("event-1");
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state);
    act(() => client.setQueryData(["event-current-user"], {ID: "another-user"}));
    expect(screen.getByTestId("state").textContent).toBe("inactive");
    expect(readPreviewCookie()).toBe("event-1");
    act(() => {client.setQueryData(["event-management-access", "event-1"], {CanManage: true}); client.setQueryData(["event-current-user"], {ID: "user-1"});});
    await waitFor(() => expect(screen.getByTestId("state").textContent).toContain("School"));
});

it("restarts the testing clock only when the test progress is explicitly reset", async () => {
    localStorage.setItem(storageKey, JSON.stringify({...state, startedAt: "2026-10-19T10:00:00.000Z"}));
    vi.useFakeTimers({toFake: ["Date"]});
    vi.setSystemTime(new Date("2026-10-20T11:00:00.000Z"));
    try {
        view();
        expect(JSON.parse(screen.getByTestId("state").textContent!).startedAt).toBe("2026-10-19T10:00:00.000Z");
        fireEvent.click(screen.getByText("Reset directly"));
        await waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey)!).startedAt).toBe("2026-10-20T11:00:00.000Z"));
    } finally {vi.useRealTimers();}
});

it("reflects preview exit from another tab without resurrecting an old tab snapshot", async () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    view();
    sessionStorage.setItem(storageKey, JSON.stringify({...state, answers: {stale: "old tab"}}));
    act(() => {localStorage.setItem(storageKey, "null"); window.dispatchEvent(new StorageEvent("storage", {key: storageKey, newValue: "null", storageArea: localStorage}));});
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("inactive"));
});


it("does not renew the cookie from a snapshot another tab retired before its effect runs", () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    document.cookie = "cib_participant_preview=event-1; Path=/; Secure";
    const setter = vi.spyOn(document, "cookie", "set");
    function RetireBeforeParentEffect() {
        useEffect(() => {localStorage.setItem(storageKey, "null");}, []);
        return null;
    }
    try {
        const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
        client.setQueryData(["event-current-user"], {ID: "user-1"});
        client.setQueryData(["event-management-access", "event-1"], {CanManage: true});
        render(<QueryClientProvider client={client}><ParticipantPreviewProvider><RetireBeforeParentEffect /></ParticipantPreviewProvider></QueryClientProvider>);
        expect(setter).not.toHaveBeenCalled();
        expect(localStorage.getItem(storageKey)).toBe("null");
    } finally {setter.mockRestore();}
});
