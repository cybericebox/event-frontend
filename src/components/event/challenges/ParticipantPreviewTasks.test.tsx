// @vitest-environment jsdom
import {afterEach, beforeAll, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {previewBoardKey} from "@/api/participantPreview";
import {ChallengeModal} from "./ChallengeModal";
import {ChallengesBoard} from "./ChallengesBoard";
import type {OwnChallenge} from "@/api/participantChallenges";

const opened = vi.hoisted(() => vi.fn());
const switches = vi.hoisted(() => ({infra: false, busy: null as "starting" | "stopping" | null}));
vi.mock("@/components/event/ParticipantPreview", () => ({useParticipantPreview: () => ({active: true, state: {status: 2, userID: "user", team: null, infra: switches.infra}, infraBusy: switches.busy, config: {HintsDisabled: false}})}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => null}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => ({EventID: "event", Tag: "event", Name: "Event", Participation: 0, StartTime: "2099-10-16T12:00:00Z", FinishTime: null})}));
vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => null}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}}), EventVpnProvider: ({children}: {children: React.ReactNode}) => children}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: opened}));
// The run lengths are a platform setting read once: answered here so the counts below are the preview's own calls.
vi.mock("@/api/testRunLengths", async importOriginal => ({...await importOriginal<typeof import("@/api/testRunLengths")>(),
    getTestRunLengths: () => Promise.resolve({AllowedMinutes: [15, 30, 60], DefaultMinutes: 60})}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const selection = "22222222-2222-4222-8222-222222222222";
const rawTask = "11111111-1111-4111-8111-111111111111";
const base: OwnChallenge = {...fixtureChallenge, ID: `${selection}:${rawTask}`, EventChallengeID: `${selection}:${rawTask}`, PreviewTaskID: rawTask,
    PreviewSelectionID: selection, PreviewDynamic: false, PreviewCanStart: true, PreviewRunID: null, EventExerciseID: selection, Lab: null,
    Snapshot: {...fixtureChallenge.Snapshot, name: "Task", description: {}}, Infrastructure: false, HintsEnabled: true,
    SolvedAt: null, HintCostTotal: 0, AttemptsLeft: null, MaxAttempts: null, SolveCount: null,
    Files: [{FileID: rawTask, Name: "task.txt", Size: 12}],
    Hints: [{ID: "h", Cost: 0, Level: "nudge", Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""}],
};
const reply = (Data: unknown, status = 200) => new Response(JSON.stringify({Data}), {status});
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function () {this.removeAttribute("open");};
});
afterEach(() => {switches.infra = false; switches.busy = null; cleanup(); fetchMock.mockReset(); opened.mockReset(); vi.restoreAllMocks();});
function mount(challenge = base) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    client.setQueryData(previewBoardKey("event"), {Challenges: [challenge], Stages: []});
    const onAccepted = vi.fn();
    const view = render(<QueryClientProvider client={client}><ChallengeModal challenge={challenge} eventID="event" mode="preview" teamMode={false} finished={false} showDifficulty showHints onAccepted={onAccepted} onClose={() => {}} /></QueryClientProvider>);
    return {client, onAccepted, ...view};
}
it("renders static downloads, unlocks actual hints, submits and reads only own preview solves", async () => {
    const {onAccepted} = mount();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("link", {name: /task.txt/}).getAttribute("href")).toContain(`/manage/participant-preview/selections/${selection}/tasks/${rawTask}/files/${rawTask}`);
    fetchMock.mockResolvedValueOnce(reply({ID: "h", Cost: 0, Unlocked: true, Content: "Server hint"}));
    fireEvent.click(screen.getByRole("button", {name: "Відкрити підказку"}));
    expect(await screen.findByText("Server hint")).toBeTruthy();
    fetchMock.mockResolvedValueOnce(reply({Correct: true}));
    fireEvent.change(screen.getByLabelText("Прапор"), {target: {value: "ICE{test}"}});
    fireEvent.click(screen.getByRole("button", {name: "Надіслати"}));
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    fetchMock.mockResolvedValueOnce(reply({Items: [], Total: 0}));
    fireEvent.click(screen.getByRole("tab", {name: "Розвʼязання"}));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes(`/manage/participant-preview/selections/${selection}/tasks/${rawTask}/`))).toBe(true);
    expect(opened).not.toHaveBeenCalled();
});
it("starts a dynamic run on click, polls preparation and opens the ready service through preview proxy", async () => {
    const {client, container} = mount({...base, Infrastructure: true, PreviewDynamic: true});
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(reply({ID: rawTask, SelectionID: selection, Dynamic: true, ExpiresAt: "2099-10-16T12:00:00Z"}));
    fetchMock.mockResolvedValueOnce(reply({Phase: "pending", Ready: false}));
    fireEvent.click(screen.getByRole("button", {name: "Запустити середовище"}));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(container.querySelector(".event-cmodal__access-state")).toBeTruthy();
    fetchMock.mockResolvedValueOnce(reply({Phase: "ready", Ready: true, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://lab.test"}]}));
    await act(async () => {await client.refetchQueries({queryKey: ["event-challenge-lab", "preview", "event", base.EventChallengeID], exact: true});});
    const tab = {opener: null, close: vi.fn(), location: {href: "about:blank"}};
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    fetchMock.mockResolvedValueOnce(reply({URL: "https://lab.test/_auth?t=preview", ExpiresAt: "2099-10-16T12:00:00Z"}));
    fireEvent.click(await screen.findByRole("button", {name: "Відкрити сервіс"}));
    await waitFor(() => expect(tab.location.href).toBe("https://lab.test/_auth?t=preview"));
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/manage/participant-preview/"))).toBe(true);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain(`/selections/${selection}/proxy`);
});
it("keeps a refused launch actionable without calling any competition lab", async () => {
    mount({...base, Infrastructure: true, PreviewDynamic: true});
    fetchMock.mockResolvedValueOnce(reply({}, 409));
    fireEvent.click(screen.getByRole("button", {name: "Запустити середовище"}));
    expect(await screen.findByText("Не вдалося запустити середовище")).toBeTruthy();
    expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(`/selections/${selection}/start`);
});

it.each([[172509], [172517], [172508]])("says there are no free resources when the test capacity is full (%s)", async code => {
    mount({...base, Infrastructure: true, PreviewDynamic: true});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({Status: {Code: code, Message: "full"}, Data: null}), {status: 409}));
    fireEvent.click(screen.getByRole("button", {name: "Запустити середовище"}));
    expect(await screen.findByText("Немає вільних ресурсів для тестової лабораторії. Спробуйте пізніше або виберіть коротший запуск.")).toBeTruthy();
    expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
});

it("names the running labs at the test-lab cap and stops only the one chosen, then starts", async () => {
    mount({...base, Infrastructure: true, PreviewDynamic: true});
    const running = [{ID: "lab-studio", Name: "SQL injection", ExpiresAt: "2099-01-01T00:00:00Z"}, {ID: "lab-preview", Name: "Port scan", EventID: "other-event", ExpiresAt: "2099-01-01T00:00:00Z"}];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({Status: {Code: 70963, Message: "limit", Context: {running}}, Data: null}), {status: 409}));
    fireEvent.click(screen.getByRole("button", {name: "Запустити середовище"}));
    expect(await screen.findByText("«SQL injection» — у студії завдань")).toBeTruthy();
    expect(screen.getByText("«Port scan» — у тестовому режимі заходу")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(new Response(null, {status: 204}));
    fetchMock.mockResolvedValueOnce(reply({ID: rawTask, SelectionID: selection, Dynamic: true, ExpiresAt: "2099-10-16T12:00:00Z"}));
    fetchMock.mockResolvedValue(reply({Phase: "pending", Ready: false}));
    fireEvent.click(screen.getAllByRole("button", {name: "Зупинити"})[0]);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(fetchMock.mock.calls[1][0]).toContain("/labs/lab-studio");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({method: "DELETE"});
    expect(fetchMock.mock.calls[2][0]).toContain(`/selections/${selection}/start`);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("lab-preview"))).toBe(false);
});

it("starts the preview's laboratory for the chosen length", async () => {
    mount({...base, Infrastructure: true, PreviewDynamic: true});
    const length = await screen.findByRole("button", {name: "Тривалість"});
    expect(length.textContent).toContain("1 год");
    fireEvent.pointerDown(length, {button: 0, ctrlKey: false});
    fireEvent.click(await screen.findByRole("menuitemradio", {name: "30 хв"}));
    fetchMock.mockResolvedValueOnce(reply({ID: rawTask, SelectionID: selection, Dynamic: true, ExpiresAt: "2099-10-16T12:00:00Z"}));
    fetchMock.mockResolvedValue(reply({Phase: "pending", Ready: false}));
    fireEvent.click(screen.getByRole("button", {name: "Запустити середовище"}));
    await waitFor(() => expect(fetchMock.mock.calls[0]?.[0]).toContain(`/selections/${selection}/start`));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({LeaseMinutes: 30});
});

it("shows the start in progress on the busy button", async () => {
    mount({...base, Infrastructure: true, PreviewDynamic: true});
    await screen.findByRole("button", {name: "Тривалість"});
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", {name: "Запустити середовище"}));
    const busy = await screen.findByRole("button", {name: "Запускаємо…"});
    expect(busy.getAttribute("data-busy")).toBe("true");
});

it.each([false, undefined])("does not offer a dynamic launch the event cannot run: %s", canStart => {
    mount({...base, Infrastructure: true, PreviewDynamic: true, PreviewCanStart: canStart});
    expect(screen.queryByRole("button", {name: "Запустити середовище"})).toBeNull();
    expect(screen.getByText("Лабораторії для цього заходу вимкнено.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
});

it("loads the normal participant board from selected preview tasks before the event starts", async () => {
    fetchMock.mockResolvedValueOnce(reply({ServerNow: "2026-10-16T12:00:00Z", Challenges: [{...base, ID: rawTask, EventChallengeID: rawTask}]}));
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><ChallengesBoard /></QueryClientProvider>);
    expect(await screen.findByRole("button", {name: /^Task/})).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/events/event/manage/participant-preview/board");
    expect(client.getQueryData(["event-own-challenges", "event"])).toBeUndefined();
    expect(client.getQueryData(["event-moderators-board", "event"])).toBeUndefined();
});

let counter = 0;
const rawId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const dynamicTask = (name: string, overrides: Partial<OwnChallenge> = {}): OwnChallenge => ({...base, PreviewTaskID: rawId(), Snapshot: {...base.Snapshot, name}, Infrastructure: true, PreviewDynamic: true, ...overrides});
const mountBoard = (...challenges: OwnChallenge[]) => {
    fetchMock.mockResolvedValue(reply({ServerNow: "2026-10-16T12:00:00Z", Challenges: challenges.map(task => ({...task, ID: task.PreviewTaskID, EventChallengeID: task.PreviewTaskID}))}));
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ChallengesBoard /></QueryClientProvider>);
};

it("lists a dynamic task as a closed card until the infrastructure runs, and keeps static tasks open", async () => {
    mountBoard(dynamicTask("Web lab"), {...base, Snapshot: {...base.Snapshot, name: "Static task"}, PreviewTaskID: rawId()});
    const card = await screen.findByRole("button", {name: /^Web lab/});
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.textContent).toContain("Запустіть інфраструктуру, щоб відкрити це завдання");
    fireEvent.click(card);
    expect(document.querySelector("dialog[open]")).toBeNull();
    expect(screen.getByRole("button", {name: /^Static task/}).getAttribute("aria-disabled")).toBeNull();
});

it("shows the launch in progress on the card with the loader, then opens it as a normal card", async () => {
    switches.infra = true; switches.busy = "starting";
    mountBoard(dynamicTask("Web lab"));
    const card = await screen.findByRole("button", {name: /^Web lab/});
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.textContent).toContain("Запускаємо інфраструктуру…");
    expect(card.querySelector(".ib-busy-mark")).toBeTruthy();
});

it("opens a dynamic task that already has a run even while the switch is off, and one the switch could not start", async () => {
    mountBoard(dynamicTask("Running", {PreviewRunID: "run"}));
    expect((await screen.findByRole("button", {name: /^Running/})).getAttribute("aria-disabled")).toBeNull();
    cleanup();
    switches.infra = true;
    mountBoard(dynamicTask("Retry"));
    expect((await screen.findByRole("button", {name: /^Retry/})).getAttribute("aria-disabled")).toBeNull();
});
