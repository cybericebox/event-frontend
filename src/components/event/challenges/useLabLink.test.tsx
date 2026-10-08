// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {LabLifecycle} from "@/api/labLifecycle";
import {runningLab, completedLab} from "@/test/labLifecycle";
import {ApiErrorCode} from "@/api/apiErrors";

const openLink = vi.fn();
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), openLabLink: (...args: unknown[]) => openLink(...args)}));

const {useLabLink, labLinkErrorMessage, PopupBlockedError} = await import("./useLabLink");
const {ParticipantChallengeError} = await import("@/api/participantChallenges");

function Probe({challengeID = "c1", moderators = false, lifecycle}: {challengeID?: string; moderators?: boolean; lifecycle?: LabLifecycle}) {
    const {state, busyKey, open, retry} = useLabLink("e", challengeID, moderators, lifecycle);
    return <>
        <button onClick={() => open("web", 80)}>open</button>
        <button onClick={retry}>retry</button>
        <output>{state.status}|{busyKey ?? ""}</output>
    </>;
}
const client = new QueryClient();
const originalRender = render;
function renderProbe(ui: React.ReactNode) { return originalRender(ui, {wrapper: ({children}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>}); }
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

type FakeTab = {location: {href: string}; close: ReturnType<typeof vi.fn>; opener: unknown};
let tab: FakeTab;
let windowOpen: ReturnType<typeof vi.fn>;

beforeEach(() => {
    tab = {location: {href: "about:blank"}, close: vi.fn(), opener: "self"};
    windowOpen = vi.fn(() => tab);
    vi.stubGlobal("open", windowOpen);
    openLink.mockResolvedValue({url: "https://web-abc123.labs.test/_auth?t=x", expiresAt: 0});
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); openLink.mockReset(); });

describe("useLabLink", () => {
    it("opens the tab synchronously in the click, then points it at the fresh link", async () => {
        let resolve: (value: unknown) => void = () => {};
        openLink.mockReturnValue(new Promise(r => { resolve = r; }));
        renderProbe(<Probe />);
        fireEvent.click(screen.getByText("open"));
        // The tab exists before the request answers, so the browser allows it.
        expect(windowOpen).toHaveBeenCalledWith("about:blank", "_blank");
        expect(tab.opener).toBeNull();
        expect(tab.location.href).toBe("about:blank");
        expect(screen.getByRole("status").textContent).toBe("pending|web:80");
        await act(async () => { resolve({url: "https://web-abc123.labs.test/_auth?t=x", expiresAt: 0}); await Promise.resolve(); });
        await flush();
        expect(tab.location.href).toBe("https://web-abc123.labs.test/_auth?t=x");
        expect(screen.getByRole("status").textContent).toBe("idle|");
        expect(openLink).toHaveBeenCalledWith("e", "c1", "web", 80, false);
    });

    it("fetches a new link on every click and keeps none", async () => {
        renderProbe(<Probe moderators />);
        fireEvent.click(screen.getByText("open"));
        await flush();
        fireEvent.click(screen.getByText("open"));
        await flush();
        expect(openLink).toHaveBeenCalledTimes(2);
        expect(openLink).toHaveBeenLastCalledWith("e", "c1", "web", 80, true);
    });

    it("closes the blank tab and shows the error when the link cannot be fetched, retry asks again", async () => {
        openLink.mockRejectedValueOnce(new ParticipantChallengeError(503, ApiErrorCode.InfrastructureUnavailable));
        renderProbe(<Probe />);
        fireEvent.click(screen.getByText("open"));
        await flush();
        expect(tab.close).toHaveBeenCalled();
        expect(screen.getByRole("status").textContent).toBe("error|");
        fireEvent.click(screen.getByText("retry"));
        await flush();
        expect(openLink).toHaveBeenCalledTimes(2);
        expect(tab.location.href).toBe("https://web-abc123.labs.test/_auth?t=x");
    });

    it("reports a blocked popup without asking the server", async () => {
        windowOpen.mockReturnValue(null);
        renderProbe(<Probe />);
        fireEvent.click(screen.getByText("open"));
        await flush();
        expect(openLink).not.toHaveBeenCalled();
        expect(screen.getByRole("status").textContent).toBe("error|");
    });

    it("does nothing without a task", async () => {
        renderProbe(<Probe challengeID="" />);
        fireEvent.click(screen.getByText("open"));
        await flush();
        expect(windowOpen).not.toHaveBeenCalled();
    });
});

describe("labLinkErrorMessage", () => {
    it("maps the known server errors and a blocked popup", () => {
        expect(labLinkErrorMessage(new ParticipantChallengeError(503, ApiErrorCode.InfrastructureUnavailable))).toContain("Інфраструктура");
        expect(labLinkErrorMessage(new ParticipantChallengeError(409, ApiErrorCode.StandLabClientMissing))).toContain("доступ");
        expect(labLinkErrorMessage(new PopupBlockedError())).toContain("вікно");
        expect(labLinkErrorMessage(new Error("x"))).toBe("Не вдалося відкрити доступ до сервісу.");
    });
});

describe("late lab link fences", () => {
    it.each([
        {challengeID: "c1", lifecycle: completedLab},
        {challengeID: "c2", lifecycle: runningLab},
        {challengeID: "c1", lifecycle: {...runningLab, Revision: "9007199254740995"}},
        {challengeID: "c1", lifecycle: {...runningLab, ID: "00000000-0000-4000-8000-000000000101"}},
    ])("closes a pending blank tab on scope change and cannot retry the old request %j", async next => {
        let resolve!: (v: unknown) => void;
        openLink.mockReturnValue(new Promise(r => {resolve = r;}));
        const view = renderProbe(<Probe lifecycle={runningLab} />);
        fireEvent.click(screen.getByText("open"));
        view.rerender(<Probe {...next} />);
        expect(tab.close).toHaveBeenCalled();
        await act(async () => {resolve({url: "https://old.test", expiresAt: 0, labID: runningLab.ID, revision: runningLab.Revision});});
        expect(tab.location.href).toBe("about:blank");
        fireEvent.click(screen.getByText("retry"));
        expect(openLink).toHaveBeenCalledTimes(1);
    });
    it.each([completedLab, {...runningLab, RuntimeState: "preparing" as const}, {...runningLab, RuntimeState: "unavailable" as const}])("never opens a window for known inaccessible lifecycle %j", lifecycle => {
        renderProbe(<Probe lifecycle={lifecycle} />);
        fireEvent.click(screen.getByText("open"));
        expect(windowOpen).not.toHaveBeenCalled();
    });
    it.each([{labID: runningLab.ID, revision: "1"}, {labID: null, revision: null}, {labID: "other", revision: runningLab.Revision}])("rejects a reply without the requested generation %j", async fields => {
        openLink.mockResolvedValue({url: "https://old.test", expiresAt: 0, ...fields});
        renderProbe(<Probe lifecycle={runningLab} />);
        fireEvent.click(screen.getByText("open")); await flush();
        expect(tab.location.href).toBe("about:blank"); expect(tab.close).toHaveBeenCalled();
    });
    it("navigates a matching current generation", async () => {
        openLink.mockResolvedValue({url: "https://fresh.test", expiresAt: 0, labID: runningLab.ID, revision: runningLab.Revision});
        renderProbe(<Probe lifecycle={runningLab} />); fireEvent.click(screen.getByText("open")); await flush();
        expect(tab.location.href).toBe("https://fresh.test");
    });
    it("closes legacy requests when lifecycle appears", async () => {
        let resolve!: (v: unknown) => void; openLink.mockReturnValue(new Promise(r => {resolve = r;}));
        const view = renderProbe(<Probe />); fireEvent.click(screen.getByText("open")); view.rerender(<Probe lifecycle={runningLab} />);
        await act(async () => {resolve({url: "https://old.test", expiresAt: 0});});
        expect(tab.location.href).toBe("about:blank"); expect(tab.close).toHaveBeenCalled();
    });
    it("closes pending windows on unmount", async () => {
        let resolve!: (v: unknown) => void; openLink.mockReturnValue(new Promise(r => {resolve = r;}));
        const view = renderProbe(<Probe lifecycle={runningLab} />); fireEvent.click(screen.getByText("open")); view.unmount();
        expect(tab.close).toHaveBeenCalled(); await act(async () => {resolve({url: "https://old.test", expiresAt: 0, labID: runningLab.ID, revision: runningLab.Revision});});
        expect(tab.location.href).toBe("about:blank");
    });
    it("closes pending windows on session cache removal", async () => {
        client.setQueryData(["event-lab-lifecycle", "participant", "e", runningLab.ID], runningLab);
        let resolve!: (v: unknown) => void; openLink.mockReturnValue(new Promise(r => {resolve = r;}));
        renderProbe(<Probe lifecycle={runningLab} />); fireEvent.click(screen.getByText("open")); await act(async () => {client.clear();});
        expect(tab.close).toHaveBeenCalled(); await act(async () => {resolve({url: "https://old.test", expiresAt: 0, labID: runningLab.ID, revision: runningLab.Revision});});
        expect(tab.location.href).toBe("about:blank"); fireEvent.click(screen.getByText("retry")); expect(openLink).toHaveBeenCalledTimes(1);
    });
});

it("fences a shared cache closure before React can render the new lifecycle", async () => {
    const key = ["event-lab-lifecycle", "participant", "e", runningLab.ID]; client.setQueryData(key, runningLab);
    let resolve!: (v: unknown) => void; openLink.mockReturnValue(new Promise(r => {resolve = r;}));
    renderProbe(<Probe lifecycle={runningLab} />); fireEvent.click(screen.getByText("open"));
    await act(async () => {client.setQueryData(key, completedLab); resolve({url: "https://old.test", expiresAt: 0, labID: runningLab.ID, revision: runningLab.Revision});});
    expect(tab.location.href).toBe("about:blank"); expect(tab.close).toHaveBeenCalled();
    fireEvent.click(screen.getByText("retry")); expect(openLink).toHaveBeenCalledTimes(1);
});
it.each([403, 409])("refreshes only affected board/runtime after an access denial %s", async status => {
    const board = vi.fn(async () => ({Challenges: []})); const runtime = vi.fn(async () => ({})); const other = vi.fn(async () => ({}));
    await client.fetchQuery({queryKey: ["event-own-challenges", "e"], queryFn: board});
    await client.fetchQuery({queryKey: ["event-challenge-lab", "participant", "e", "c1"], queryFn: runtime});
    await client.fetchQuery({queryKey: ["event-own-challenges", "other"], queryFn: other});
    openLink.mockRejectedValue(new ParticipantChallengeError(status, ApiErrorCode.TeamNotAdmitted));
    renderProbe(<Probe lifecycle={runningLab} />); fireEvent.click(screen.getByText("open")); await flush();
    expect(tab.location.href).toBe("about:blank"); expect(tab.close).toHaveBeenCalled();
    expect(board).toHaveBeenCalledTimes(2); expect(runtime).toHaveBeenCalledTimes(2); expect(other).toHaveBeenCalledTimes(1);
});

it("closes a legacy blank tab when the same task runtime first publishes Lab before rerender", async () => {
    const key = ["event-challenge-lab", "participant", "e", "c1"];
    client.setQueryData(key, {Lab: null});
    let resolve!: (v: unknown) => void; openLink.mockReturnValue(new Promise(r => {resolve = r;}));
    renderProbe(<Probe />); fireEvent.click(screen.getByText("open"));
    await act(async () => {client.setQueryData(key, {Lab: runningLab}); resolve({url: "https://old.test", expiresAt: 0, labID: null, revision: null});});
    expect(tab.location.href).toBe("about:blank"); expect(tab.close).toHaveBeenCalled();
    fireEvent.click(screen.getByText("retry")); expect(openLink).toHaveBeenCalledTimes(1);
});
