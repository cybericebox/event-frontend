// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {ApiErrorCode} from "@/api/apiErrors";

const open = vi.fn();
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), openLabSession: (...args: unknown[]) => open(...args)}));

const {useLabSession, labSessionErrorMessage, resetLabSessionMemo} = await import("./useLabSession");
const {ParticipantChallengeError} = await import("@/api/participantChallenges");

function Probe({challengeID, active = true, moderators = false}: {challengeID?: string; active?: boolean; moderators?: boolean}) {
    const {state, retry} = useLabSession("e", challengeID, active, moderators);
    return <button onClick={retry}>{state.status}</button>;
}
const flush = () => act(async () => { await Promise.resolve(); });
const TTL = 60 * 60 * 1000;

beforeEach(() => { resetLabSessionMemo(); vi.useFakeTimers(); open.mockResolvedValue({expiresAt: Date.now() + TTL}); });
afterEach(() => { cleanup(); vi.useRealTimers(); open.mockReset(); });

describe("useLabSession", () => {
    it("opens the session once when a web task opens", async () => {
        render(<Probe challengeID="c1" />);
        await flush();
        expect(open).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith("e", "c1", false);
        expect(screen.getByRole("button").textContent).toBe("ready");
    });

    it("uses the manage route for the moderators team", async () => {
        render(<Probe challengeID="c1" moderators />);
        await flush();
        expect(open).toHaveBeenCalledWith("e", "c1", true);
    });

    it("does nothing for a task without web access or a closed modal", async () => {
        render(<><Probe challengeID="c1" active={false} /><Probe challengeID={undefined} /></>);
        await flush();
        expect(open).not.toHaveBeenCalled();
    });

    it("does not renew in a loop while the task stays open", async () => {
        render(<Probe challengeID="c1" />);
        await flush();
        await act(async () => { vi.advanceTimersByTime(TTL * 5); });
        expect(open).toHaveBeenCalledTimes(1);
    });

    it("does not re-request when another task of the same event opens", async () => {
        const view = render(<Probe challengeID="c1" />);
        await flush();
        view.rerender(<Probe challengeID="c2" />);
        await flush();
        expect(open).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button").textContent).toBe("ready");
    });

    it("requests again after the remembered expiry passed", async () => {
        const view = render(<Probe challengeID="c1" />);
        await flush();
        view.rerender(<Probe challengeID={undefined} />);
        vi.setSystemTime(Date.now() + TTL + 1000);
        view.rerender(<Probe challengeID="c1" />);
        await flush();
        expect(open).toHaveBeenCalledTimes(2);
    });

    it("retries once on 401", async () => {
        open.mockRejectedValueOnce(new ParticipantChallengeError(401));
        render(<Probe challengeID="c1" />);
        await flush();
        expect(open).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button").textContent).toBe("ready");
    });

    it("gives up after a second 401", async () => {
        open.mockRejectedValue(new ParticipantChallengeError(401));
        render(<Probe challengeID="c1" />);
        await flush();
        expect(open).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button").textContent).toBe("error");
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
