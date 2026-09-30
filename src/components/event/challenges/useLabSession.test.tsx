// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {ApiErrorCode} from "@/api/apiErrors";

const open = vi.fn();
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), openLabSession: (...args: unknown[]) => open(...args)}));

const {useLabSession, labSessionErrorMessage} = await import("./useLabSession");
const {ParticipantChallengeError} = await import("@/api/participantChallenges");

function Probe({challengeID, active = true}: {challengeID?: string; active?: boolean}) {
    const {state, retry} = useLabSession("e", challengeID, active);
    return <button onClick={retry}>{state.status}</button>;
}
const flush = () => act(async () => { await Promise.resolve(); });
const TTL = 60 * 60 * 1000;

beforeEach(() => { vi.useFakeTimers(); open.mockResolvedValue({expiresAt: Date.now() + TTL}); });
afterEach(() => { cleanup(); vi.useRealTimers(); open.mockReset(); });

describe("useLabSession", () => {
    it("opens the session once when a web task opens", async () => {
        render(<Probe challengeID="c1" />);
        await flush();
        expect(open).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith("e", "c1");
        expect(screen.getByRole("button").textContent).toBe("ready");
    });

    it("does nothing for a task without web access or a closed modal", async () => {
        render(<><Probe challengeID="c1" active={false} /><Probe challengeID={undefined} /></>);
        await flush();
        expect(open).not.toHaveBeenCalled();
    });

    it("renews silently at 80% of the lifetime", async () => {
        render(<Probe challengeID="c1" />);
        await flush();
        await act(async () => { vi.advanceTimersByTime(TTL * 0.79); });
        expect(open).toHaveBeenCalledTimes(1);
        await act(async () => { vi.advanceTimersByTime(TTL * 0.02); });
        expect(open).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button").textContent).toBe("ready");
    });

    it("waits for a visible tab before renewing", async () => {
        render(<Probe challengeID="c1" />);
        await flush();
        const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        await act(async () => { vi.advanceTimersByTime(TTL); });
        expect(open).toHaveBeenCalledTimes(1);
        visibility.mockReturnValue("visible");
        await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
        expect(open).toHaveBeenCalledTimes(2);
        visibility.mockRestore();
    });

    it("stops renewing when the modal closes", async () => {
        const view = render(<Probe challengeID="c1" />);
        await flush();
        view.rerender(<Probe challengeID={undefined} />);
        await act(async () => { vi.advanceTimersByTime(TTL * 2); });
        expect(open).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button").textContent).toBe("idle");
    });

    it("reports a failure and retries on demand", async () => {
        open.mockRejectedValueOnce(new ParticipantChallengeError(503, ApiErrorCode.InfrastructureUnavailable));
        render(<Probe challengeID="c1" />);
        await flush();
        expect(screen.getByRole("button").textContent).toBe("error");
        fireEvent.click(screen.getByRole("button"));
        await flush();
        expect(open).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button").textContent).toBe("ready");
    });
});

describe("labSessionErrorMessage", () => {
    it("maps the backend codes to their own messages", () => {
        const message = (code?: number) => labSessionErrorMessage(new ParticipantChallengeError(409, code));
        const texts = new Set([ApiErrorCode.InfrastructureUnavailable, ApiErrorCode.TeamNotAdmitted, ApiErrorCode.ChallengeNotPublished, ApiErrorCode.ParticipantNotApproved, undefined].map(message));
        expect(texts.size).toBe(5);
        expect(message(ApiErrorCode.InfrastructureUnavailable)).toContain("Інфраструктура");
    });
});
