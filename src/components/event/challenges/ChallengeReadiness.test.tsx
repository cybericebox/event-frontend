// @vitest-environment jsdom
import {afterEach, beforeAll, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {runningLab, completedLab, runtimeFixture} from "@/test/labLifecycle";
import type {LabRuntime} from "@/api/manageLabs";
import type {OwnChallenge} from "@/api/participantChallenges";
import {Board} from "./ChallengesBoard";
import type {BoardMode} from "./ChallengeModal";

const api = vi.hoisted(() => ({runtime: vi.fn(), start: vi.fn(), opened: vi.fn(), preview: false}));
vi.mock("@/components/event/ParticipantPreview", () => ({useParticipantPreview: () => ({active: api.preview, infraBusy: null})}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}})}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: api.opened}));
vi.mock("@/api/participantChallenges", async original => ({...await original<typeof import("@/api/participantChallenges")>(), getOwnChallengeLab: () => api.runtime()}));
vi.mock("@/api/manageLabs", async original => ({...await original<typeof import("@/api/manageLabs")>(), getModeratorChallengeLab: () => api.runtime()}));
vi.mock("@/api/participantPreview", async original => ({...await original<typeof import("@/api/participantPreview")>(), getPreviewLab: () => api.runtime(), startPreviewRun: (...args: unknown[]) => api.start(...args)}));
vi.mock("@/api/testRunLengths", async original => ({...await original<typeof import("@/api/testRunLengths")>(), getTestRunLengths: async () => ({AllowedMinutes: [15, 30], DefaultMinutes: 30})}));
vi.mock("@/utils/origins", async original => ({...await original<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
const documentWith = (...names: string[]) => ({root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: "Task secret "}, ...names.map(varName => ({type: "variable", varName}))]}]}});
const task: OwnChallenge = {...fixtureChallenge, SolvedAt: null, Lab: runningLab, Snapshot: {...fixtureChallenge.Snapshot, name: "Web task", description: documentWith("web"), placeholders: [{key: "web", kind: "external.link", device_name: "web"}]}, Hints: [], SolveCount: null, Files: [{FileID: "file", Name: "secret.zip", Size: 10}]};
const ready: LabRuntime = {...runtimeFixture, Access: [{Device: "web", Port: 80, Protocol: "https", URL: "https://web.test"}]};
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(reply => {resolve = reply;}); return {promise, resolve};}
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function () {this.removeAttribute("open"); this.dispatchEvent(new Event("close"));};
});
afterEach(() => {cleanup(); api.runtime.mockReset(); api.start.mockReset(); api.opened.mockReset(); api.preview = false;});
function mount(challenge: OwnChallenge = task, mode: BoardMode = "participant", finished = false) {
    api.preview = mode === "preview";
    const actual = mode === "preview" ? {...challenge, Lab: null, PreviewSelectionID: "selection", PreviewDynamic: true, PreviewCanStart: true, PreviewRunID: "run"} : challenge;
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const renderBoard = (value = actual) => <QueryClientProvider client={client}><Board challenges={[value]} eventID="event" mode={mode} teamMode={false} finished={finished} showDifficulty showHints onRefresh={() => {}} /></QueryClientProvider>;
    const view = render(renderBoard());
    const key = ["event-challenge-lab", mode, "event", actual.EventChallengeID];
    return {...view, client, key, actual, update: (value: OwnChallenge) => view.rerender(renderBoard(value)), tile: () => view.container.querySelector<HTMLButtonElement>("[data-challenge-id]")!};
}
function expectPreparing(container: HTMLElement, tile: HTMLElement) {
    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(container.querySelector(".ib-cmodal__desc")).toBeNull();
    expect(tile.getAttribute("aria-busy")).toBe("true");
    expect(tile.querySelector(".ib-tile__loading-logo")).toBeTruthy();
    expect(api.opened).not.toHaveBeenCalled();
}
it.each(["participant", "moderators", "preview"] as const)("keeps %s task unopened and its tile busy until the deferred current runtime resolves", async mode => {
    const response = deferred<LabRuntime>(); api.runtime.mockReturnValue(response.promise);
    const view = mount(task, mode);
    fireEvent.click(view.tile());
    expectPreparing(view.container, view.tile());
    await act(async () => response.resolve(mode === "preview" ? {...ready, Lab: null} : ready));
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
    expect(view.tile().getAttribute("aria-busy")).toBeNull();
    expect(view.container.querySelector("dialog[open]")).toBeTruthy();
    expect(api.runtime).toHaveBeenCalledTimes(1);
});
it("waits for Ready and required late fields, but ignores irrelevant empty networks and unused definitions", async () => {
    api.runtime.mockResolvedValue({...ready, Ready: false});
    const view = mount({...task, Snapshot: {...task.Snapshot, placeholders: [...task.Snapshot.placeholders, {key: "unused", kind: "internet.subnet"}]}});
    fireEvent.click(view.tile());
    await waitFor(() => expect(view.client.getQueryData(view.key)).toBeTruthy());
    expectPreparing(view.container, view.tile());
    await act(async () => {view.client.setQueryData(view.key, {...ready, Access: []});});
    expectPreparing(view.container, view.tile());
    await act(async () => {view.client.setQueryData(view.key, ready);});
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
});
it("opens static IP content without a lab request", async () => {
    const view = mount({...task, Infrastructure: false, Lab: null, Snapshot: {...task.Snapshot, description: documentWith("ip"), placeholders: [{key: "ip", kind: "ip", ip_reference: "static", octets_1to3: "192.0.2", last_octet: 5}]}});
    fireEvent.click(view.tile());
    expect(await screen.findByText("192.0.2.5")).toBeTruthy();
    expect(api.runtime).not.toHaveBeenCalled();
});
it("turns unknown referenced definitions into retryable setup without exposing task content", async () => {
    api.runtime.mockResolvedValue(ready);
    const view = mount({...task, Snapshot: {...task.Snapshot, description: documentWith("unknown")}});
    fireEvent.click(view.tile());
    expect(await screen.findByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    expect(view.tile().getAttribute("aria-busy")).toBeNull();
    expect(view.container.querySelector(".ib-cmodal__desc")).toBeNull();
    expect(screen.queryByRole("button", {name: /secret.zip/})).toBeNull();
    expect(screen.queryByLabelText("Прапор")).toBeNull();
});
it("retains matching usable cached access after a refresh failure", async () => {
    api.runtime.mockRejectedValue(new Error("offline"));
    const view = mount(); view.client.setQueryData(view.key, ready);
    fireEvent.click(view.tile());
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
    await waitFor(() => expect(view.client.getQueryState(view.key)?.status).toBe("error"));
    expect(view.container.querySelector("dialog[open]")).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Спробувати ще раз"})).toBeNull();
});
it("rejects stale identity/revision and opens after the matching observation arrives", async () => {
    api.runtime.mockResolvedValue({...ready, Lab: {...runningLab, Revision: "1"}});
    const view = mount(); fireEvent.click(view.tile());
    await waitFor(() => expect(view.client.getQueryData(view.key)).toBeTruthy());
    expectPreparing(view.container, view.tile());
    await act(async () => {view.client.setQueryData(view.key, {...ready, Lab: {...runningLab, ID: "00000000-0000-4000-8000-000000000999"}});});
    expectPreparing(view.container, view.tile());
    await act(async () => {view.client.setQueryData(view.key, ready);});
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
});
it("renders terminal review and solved shared-running access without blocking on preparation", async () => {
    api.runtime.mockReturnValue(new Promise(() => {}));
    const view = mount({...task, SolvedAt: "2026-10-01T12:00:00Z", Lab: completedLab});
    fireEvent.click(view.tile());
    expect(screen.getByText("Розвʼязано", {selector: "b"})).toBeTruthy();
    expect(api.runtime).not.toHaveBeenCalled();
});
it("keeps a failed fetch actionable and moves retry preparation back to the tile", async () => {
    api.runtime.mockRejectedValueOnce(new Error("offline"));
    const response = deferred<LabRuntime>(); api.runtime.mockReturnValueOnce(response.promise);
    const view = mount(); fireEvent.click(view.tile());
    fireEvent.click(await screen.findByRole("button", {name: "Спробувати ще раз"}));
    await waitFor(() => expect(view.tile().getAttribute("aria-busy")).toBe("true"));
    expectPreparing(view.container, view.tile());
    await act(async () => response.resolve(ready));
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
});
it("keeps preview manual start and length controls reachable without unresolved task content", async () => {
    const view = mount(task, "preview"); view.update({...view.actual, PreviewRunID: null});
    fireEvent.click(view.tile());
    expect(await screen.findByRole("button", {name: "Тривалість"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Запустити середовище"})).toBeTruthy();
    expect(view.container.querySelector(".ib-cmodal__desc")).toBeNull();
    expect(screen.queryByLabelText("Прапор")).toBeNull();
    const response = deferred<LabRuntime>(); api.runtime.mockReturnValue(response.promise);
    api.start.mockResolvedValue({ID: "new-run", ExpiresAt: "2099-01-01T00:00:00Z"});
    fireEvent.click(screen.getByRole("button", {name: "Запустити середовище"}));
    await waitFor(() => expect(view.tile().getAttribute("aria-busy")).toBe("true"));
    expectPreparing(view.container, view.tile());
    await act(async () => response.resolve({...ready, Lab: null}));
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
});

it("keeps an admitted task and entered flag mounted when a newly unlocked hint needs a late value", async () => {
    api.runtime.mockResolvedValue(ready);
    const hint = {ID: "hint", Level: "nudge" as const, Cost: 0, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""};
    const view = mount({...task, HintsEnabled: true, Hints: [hint], Snapshot: {...task.Snapshot, placeholders: [...task.Snapshot.placeholders, {key: "later", kind: "internet.subnet"}]}});
    fireEvent.click(view.tile());
    const flag = await screen.findByLabelText("Прапор");
    fireEvent.change(flag, {target: {value: "ICE{typing}"}});
    const dialog = view.container.querySelector("dialog");
    view.update({...view.actual, Hints: [{...hint, Unlocked: true, Content: JSON.stringify(documentWith("later"))}]});
    expect(view.container.querySelector("dialog[open]")).toBe(dialog);
    expect(screen.getByLabelText("Прапор")).toBe(flag);
    expect((flag as HTMLInputElement).value).toBe("ICE{typing}");
    expect(screen.getByRole("status", {name: "Лабораторія запускається…"})).toBeTruthy();
    expect(view.container.querySelector(".event-cmodal__hint-body")?.textContent).not.toContain("—");
    await act(async () => {view.client.setQueryData(view.key, {...ready, InternetCIDR: "10.9.4.0/24"});});
    await waitFor(() => expect(view.container.querySelector(".event-cmodal__hint-text")?.textContent).toContain("10.9.4.0/24"));
    expect(screen.getByLabelText("Прапор")).toBe(flag);
});
it("never admits cached addresses from an older preview run under the same question key", async () => {
    api.runtime.mockResolvedValueOnce({...ready, Lab: null});
    const next = deferred<LabRuntime>(); api.runtime.mockReturnValue(next.promise);
    const view = mount(task, "preview"); fireEvent.click(view.tile());
    await screen.findByRole("link", {name: "https://web.test"});
    view.update({...view.actual, PreviewRunID: "replacement-run"});
    expectPreparing(view.container, view.tile());
    await act(async () => next.resolve({...ready, Lab: null, Access: [{Device: "web", Port: 80, Protocol: "https", URL: "https://new-run.test"}]}));
    expect(await screen.findByRole("link", {name: "https://new-run.test"})).toBeTruthy();
});
it("opens expired preview setup instead of waiting forever or displaying stale task content", async () => {
    api.runtime.mockResolvedValue({...ready, Lab: null});
    const view = mount(task, "preview"); view.update({...view.actual, PreviewExpiresAt: "2000-01-01T00:00:00Z"});
    fireEvent.click(view.tile());
    expect(await screen.findByRole("button", {name: "Запустити середовище"})).toBeTruthy();
    expect(view.container.querySelector(".ib-cmodal__desc")).toBeNull();
    expect(api.runtime).not.toHaveBeenCalled();
});

it.each(["failed", "unavailable"] as const)("makes a %s environment actionable without exposing unresolved task content", async state => {
    api.runtime.mockResolvedValue(state === "failed" ? {...ready, Ready: false, Phase: "failed"} : {...ready, Ready: false, Lab: {...runningLab, RuntimeState: "unavailable"}});
    const view = mount(); fireEvent.click(view.tile());
    expect(await screen.findByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    expect(view.container.querySelector(".ib-cmodal__desc")).toBeNull();
    expect(view.tile().getAttribute("aria-busy")).toBeNull();
});
it("keeps hidden paid hint dependencies out of initial readiness", async () => {
    api.runtime.mockResolvedValue(ready);
    const view = mount({...task, HintsEnabled: true, Hints: [{ID: "paid", Level: "nudge", Cost: 10, Unlocked: false, Content: JSON.stringify(documentWith("unknown")), UnlockedAt: null, UnlockedByName: ""}]});
    fireEvent.click(view.tile());
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
    expect(screen.getByLabelText("Прапор")).toBeTruthy();
});
it("exposes preview start after the runtime reports expiry before the board catches up", async () => {
    api.runtime.mockResolvedValue({...ready, Lab: null, Ready: false, Expired: true});
    const view = mount(task, "preview"); fireEvent.click(view.tile());
    expect(await screen.findByRole("button", {name: "Запустити середовище"})).toBeTruthy();
    expect(view.container.querySelector(".ib-cmodal__desc")).toBeNull();
});

it("does not recreate preview runtime authority when a pending manual start resolves after logout", async () => {
    const started = deferred<{ID: string; ExpiresAt: string}>(); api.start.mockReturnValue(started.promise);
    const view = mount(task, "preview"); view.update({...view.actual, PreviewRunID: null});
    fireEvent.click(view.tile());
    fireEvent.click(await screen.findByRole("button", {name: "Запустити середовище"}));
    view.unmount(); view.client.clear();
    await act(async () => started.resolve({ID: "late-run", ExpiresAt: "2099-01-01T00:00:00Z"}));
    expect(view.client.getQueryCache().getAll()).toHaveLength(0);
});
it("a moderator's visible hint dependencies participate in initial readiness", async () => {
    api.runtime.mockResolvedValue(ready);
    const view = mount({...task, HintsEnabled: true, Hints: [{ID: "hint", Level: "nudge", Cost: 10, Unlocked: false, Content: JSON.stringify(documentWith("unknown")), UnlockedAt: null, UnlockedByName: ""}]}, "moderators");
    fireEvent.click(view.tile());
    expect(await screen.findByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
    expect(view.container.querySelector(".ib-cmodal__desc")).toBeNull();
});

it.each(["Expired", "Removing"] as const)("replacement preview run ignores the previous run's %s observation", async flag => {
    api.runtime.mockResolvedValueOnce({...ready, Lab: null, Ready: false, [flag]: true});
    const view = mount(task, "preview"); fireEvent.click(view.tile());
    await screen.findByRole("button", {name: "Запустити середовище"});
    const next = deferred<LabRuntime>(); api.runtime.mockReturnValue(next.promise);
    view.update({...view.actual, PreviewRunID: "replacement-run"});
    expectPreparing(view.container, view.tile());
    await waitFor(() => expect(api.runtime).toHaveBeenCalledTimes(2));
    await act(async () => next.resolve({...ready, Lab: null}));
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
});
it("replacement preview run immediately observes its own runtime after the old run's first GET failed", async () => {
    api.runtime.mockRejectedValueOnce(new Error("old run offline"));
    const view = mount(task, "preview"); fireEvent.click(view.tile());
    await screen.findByRole("button", {name: "Спробувати ще раз"});
    const next = deferred<LabRuntime>(); api.runtime.mockReturnValue(next.promise);
    view.update({...view.actual, PreviewRunID: "replacement-run"});
    expectPreparing(view.container, view.tile());
    expect(api.runtime).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({...ready, Lab: null}));
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
});
it("replacement preview run cancels an obsolete first GET before observing its own runtime", async () => {
    const old = deferred<LabRuntime & {Expired?: boolean}>(); const next = deferred<LabRuntime>();
    api.runtime.mockReturnValueOnce(old.promise).mockReturnValue(next.promise);
    const view = mount(task, "preview"); fireEvent.click(view.tile());
    view.update({...view.actual, PreviewRunID: "replacement-run"});
    expectPreparing(view.container, view.tile());
    expect(api.runtime).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({...ready, Lab: null}));
    await screen.findByRole("link", {name: "https://web.test"});
    await act(async () => old.resolve({...ready, Lab: null, Ready: false, Expired: true}));
    expect(view.container.querySelector("dialog[open]")).toBeTruthy();
    expect(screen.getByRole("link", {name: "https://web.test"})).toBeTruthy();
});
it.each([false, true])("a solved task with a live shared lab waits for initial runtime admission (practice=%s)", async practice => {
    const response = deferred<LabRuntime>(); api.runtime.mockReturnValue(response.promise);
    const view = mount({...task, SolvedAt: practice ? null : "2026-10-01T12:00:00Z", Practice: practice});
    fireEvent.click(view.tile());
    expectPreparing(view.container, view.tile());
    await act(async () => response.resolve(ready));
    expect(await screen.findByRole("link", {name: "https://web.test"})).toBeTruthy();
    expect(screen.getByText(practice ? "Розвʼязано (практика, без балів)" : "Розвʼязано", {selector: "b"})).toBeTruthy();
    expect(screen.queryByLabelText("Прапор")).toBeNull();
});
