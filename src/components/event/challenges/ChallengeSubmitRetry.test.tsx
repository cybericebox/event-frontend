// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
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

const open = {...fixtureChallenge, SolvedAt: null, Infrastructure: false, MaxAttempts: null, AttemptsLeft: null};
const overloaded = () => new ParticipantChallengeError(503, undefined, 1);

const client = new QueryClient();
const modal = (challenge: typeof open) => <QueryClientProvider client={client}>
    <ChallengeModal challenge={challenge} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={() => {}} onAccepted={() => {}} onRejected={() => {}} />
</QueryClientProvider>;
function renderModal() {
    return render(modal(open));
}
const flag = () => screen.getByLabelText("Прапор") as HTMLInputElement;
const keys = () => api.submit.mock.calls.map(call => call[3]);
async function send(answer: string) {
    fireEvent.change(flag(), {target: {value: answer}});
    await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Надіслати"}));});
}

describe("answer retry after an overloaded server", () => {
    it("shows the overloaded line with a retry that sends the same answer under the same key", async () => {
        api.submit.mockRejectedValueOnce(overloaded()).mockResolvedValueOnce({Correct: false, FirstSolve: false});
        renderModal();
        await send("ICE{a}");
        expect(screen.getByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeTruthy();
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Спробувати ще раз"}));});
        expect(api.submit).toHaveBeenCalledTimes(2);
        expect(api.submit.mock.calls[1][2]).toBe("ICE{a}");
        expect(keys()[1]).toBe(keys()[0]);
        expect(screen.queryByRole("button", {name: "Спробувати ще раз"})).toBeNull();
    });

    it("reuses the key for the same answer after a failure and takes a new one for a changed answer", async () => {
        api.submit.mockRejectedValueOnce(overloaded()).mockRejectedValueOnce(overloaded()).mockRejectedValueOnce(overloaded());
        renderModal();
        await send("ICE{a}");
        await send(" ICE{a} ");
        await send("ICE{b}");
        expect(keys()[1]).toBe(keys()[0]);
        expect(keys()[2]).not.toBe(keys()[0]);
    });

    it("takes a new key after a verdict, even for the same answer", async () => {
        api.submit.mockResolvedValue({Correct: false, FirstSolve: false});
        renderModal();
        await send("ICE{a}");
        await send("ICE{a}");
        expect(keys()[1]).not.toBe(keys()[0]);
    });

    it("drops the retry when the answer is edited after the overloaded line", async () => {
        api.submit.mockRejectedValueOnce(overloaded());
        renderModal();
        await send("ICE{a}");
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
        fireEvent.change(flag(), {target: {value: "ICE{b}"}});
        expect(screen.queryByRole("button", {name: "Спробувати ще раз"})).toBeNull();
        expect(screen.queryByText("Сервер перевантажений, спробуйте за кілька секунд")).toBeNull();
    });

    it("takes a new key for the same answer on another challenge", async () => {
        api.submit.mockRejectedValue(overloaded());
        const view = renderModal();
        await send("ICE{a}");
        const other = {...open, ID: "33333333-3333-4333-8333-333333333333", EventChallengeID: "44444444-4444-4444-8444-444444444444"};
        view.rerender(modal(other));
        await send("ICE{a}");
        view.rerender(modal(open));
        await send("ICE{a}");
        expect(api.submit.mock.calls.map(call => call[1])).toEqual([open.EventChallengeID, other.EventChallengeID, open.EventChallengeID]);
        expect(new Set(keys()).size).toBe(3);
    });
});
