// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {ApiErrorCode} from "@/api/apiErrors";

const openLink = vi.fn();
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), openLabLink: (...args: unknown[]) => openLink(...args)}));

const {useLabLink, labLinkErrorMessage, PopupBlockedError} = await import("./useLabLink");
const {ParticipantChallengeError} = await import("@/api/participantChallenges");

function Probe({challengeID = "c1", moderators = false}: {challengeID?: string; moderators?: boolean}) {
    const {state, busyKey, open, retry} = useLabLink("e", challengeID, moderators);
    return <>
        <button onClick={() => open("web", 80)}>open</button>
        <button onClick={retry}>retry</button>
        <output>{state.status}|{busyKey ?? ""}</output>
    </>;
}
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); openLink.mockReset(); });

describe("useLabLink", () => {
    it("opens the tab synchronously in the click, then points it at the fresh link", async () => {
        let resolve: (value: unknown) => void = () => {};
        openLink.mockReturnValue(new Promise(r => { resolve = r; }));
        render(<Probe />);
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
        render(<Probe moderators />);
        fireEvent.click(screen.getByText("open"));
        await flush();
        fireEvent.click(screen.getByText("open"));
        await flush();
        expect(openLink).toHaveBeenCalledTimes(2);
        expect(openLink).toHaveBeenLastCalledWith("e", "c1", "web", 80, true);
    });

    it("closes the blank tab and shows the error when the link cannot be fetched, retry asks again", async () => {
        openLink.mockRejectedValueOnce(new ParticipantChallengeError(503, ApiErrorCode.InfrastructureUnavailable));
        render(<Probe />);
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
        render(<Probe />);
        fireEvent.click(screen.getByText("open"));
        await flush();
        expect(openLink).not.toHaveBeenCalled();
        expect(screen.getByRole("status").textContent).toBe("error|");
    });

    it("does nothing without a task", async () => {
        render(<Probe challengeID="" />);
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
