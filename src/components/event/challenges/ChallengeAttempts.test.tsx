// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ApiErrorCode} from "@/api/apiErrors";
import {fixtureChallenge} from "./fixtures/challengeFixture";

const api = vi.hoisted(() => ({submit: vi.fn()}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}})}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/api/participantChallenges", async importOriginal => ({
    ...await importOriginal<typeof import("@/api/participantChallenges")>(),
    getOwnChallengeLab: () => new Promise(() => {}),
    submitChallenge: (...args: unknown[]) => api.submit(...args),
}));

const {ChallengeModal} = await import("./ChallengeModal");
const {ParticipantChallengeError} = await import("@/api/participantChallenges");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); api.submit.mockReset();});

const open = {...fixtureChallenge, SolvedAt: null, Infrastructure: false};

function renderModal(challenge: typeof open, onRejected = vi.fn()) {
    const view = render(<QueryClientProvider client={new QueryClient()}>
        <ChallengeModal challenge={challenge} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={() => {}} onAccepted={() => {}} onRejected={onRejected} />
    </QueryClientProvider>);
    return {...view, onRejected};
}
const flag = () => screen.getByLabelText("Прапор") as HTMLInputElement;
const submitButton = () => screen.getByRole("button", {name: "Надіслати"}) as HTMLButtonElement;
async function send(answer: string) {
    fireEvent.change(flag(), {target: {value: answer}});
    await act(async () => {fireEvent.click(submitButton());});
}

describe("flag attempts in the challenge modal", () => {
    it("shows nothing when the task is unlimited", () => {
        renderModal({...open, MaxAttempts: null, AttemptsLeft: null});
        expect(screen.queryByText(/Залишилось спроб/)).toBeNull();
        expect(flag().disabled).toBe(false);
    });

    it("shows the attempts left under the submit button", () => {
        renderModal({...open, MaxAttempts: 3, AttemptsLeft: 2});
        expect(screen.getByText("Залишилось спроб: 2")).toBeTruthy();
        expect(flag().disabled).toBe(false);
    });

    it("counts a wrong answer at once and asks the board to refresh", async () => {
        api.submit.mockResolvedValue({Correct: false, FirstSolve: false});
        const {onRejected} = renderModal({...open, MaxAttempts: 3, AttemptsLeft: 2});
        await send("ICE{wrong}");
        expect(screen.getByText("Залишилось спроб: 1")).toBeTruthy();
        expect(onRejected).toHaveBeenCalledTimes(1);
        await send("ICE{wrong2}");
        expect(flag().disabled).toBe(true);
        expect(submitButton().disabled).toBe(true);
        expect(screen.queryByText(/Залишилось спроб/)).toBeNull();
        expect(screen.getByText(/Спроби вичерпано/)).toBeTruthy();
    });

    it("is disabled with a message when no attempts are left", () => {
        renderModal({...open, MaxAttempts: 3, AttemptsLeft: 0});
        expect(flag().disabled).toBe(true);
        expect(submitButton().disabled).toBe(true);
        expect(screen.getByText(/Спроби вичерпано/)).toBeTruthy();
    });

    it("locks the form when the server says the limit is reached", async () => {
        api.submit.mockRejectedValue(new ParticipantChallengeError(409, ApiErrorCode.AttemptLimitReached));
        const {onRejected} = renderModal({...open, MaxAttempts: 5, AttemptsLeft: 4});
        await send("ICE{x}");
        expect(flag().disabled).toBe(true);
        expect(screen.getByText(/Спроби вичерпано/)).toBeTruthy();
        expect(onRejected).toHaveBeenCalledTimes(1);
    });

    it("takes the refreshed count from the board instead of counting twice", async () => {
        api.submit.mockResolvedValue({Correct: false, FirstSolve: false});
        const view = renderModal({...open, MaxAttempts: 3, AttemptsLeft: 2});
        await send("ICE{wrong}");
        expect(screen.getByText("Залишилось спроб: 1")).toBeTruthy();
        // The board refetch already includes that attempt.
        view.rerender(<QueryClientProvider client={new QueryClient()}>
            <ChallengeModal challenge={{...open, MaxAttempts: 3, AttemptsLeft: 1}} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={() => {}} onAccepted={() => {}} />
        </QueryClientProvider>);
        expect(screen.getByText("Залишилось спроб: 1")).toBeTruthy();
    });
});
