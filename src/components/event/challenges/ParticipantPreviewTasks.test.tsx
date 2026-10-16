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
vi.mock("@/components/event/ParticipantPreview", () => ({useParticipantPreview: () => ({active: true, state: {status: 2, userID: "user", team: null}, config: {HintsDisabled: false}})}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => null}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => ({EventID: "event", Tag: "event", Name: "Event", Participation: 0, StartTime: "2099-10-16T12:00:00Z", FinishTime: null})}));
vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => null}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}}), EventVpnProvider: ({children}: {children: React.ReactNode}) => children}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: opened}));
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
afterEach(() => {cleanup(); fetchMock.mockReset(); opened.mockReset(); vi.restoreAllMocks();});
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

it.each([false, undefined])("does not offer a dynamic launch without confirmed event allocation: %s", canStart => {
    mount({...base, Infrastructure: true, PreviewDynamic: true, PreviewCanStart: canStart});
    expect(screen.queryByRole("button", {name: "Запустити середовище"})).toBeNull();
    expect(screen.getByText(/Для запуску потрібні виділені ресурси заходу/)).toBeTruthy();
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
