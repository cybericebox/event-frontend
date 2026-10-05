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
const {ChallengeTile} = await import("./ChallengeTile");
const {ParticipantChallengeError} = await import("@/api/participantChallenges");

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => {cleanup(); api.submit.mockReset();});

const stage = {ID: "55555555-5555-4555-8555-555555555555", Name: "Розминка", OpensAt: "2026-10-01T08:00:00Z", ClosesAt: "2026-10-01T10:00:00Z", Returnable: false, State: "closed" as const};
const base = {...fixtureChallenge, SolvedAt: null, Infrastructure: false, StageID: stage.ID, MaxAttempts: null, AttemptsLeft: null};

function renderModal(challenge: typeof base, stageValue: typeof stage | null, onRejected = vi.fn()) {
    render(<QueryClientProvider client={new QueryClient()}>
        <ChallengeModal challenge={challenge} stage={stageValue} eventID="e" mode="participant" teamMode finished={false} showDifficulty showHints hintChargeMode="reward" onClose={() => {}} onAccepted={() => {}} onRejected={onRejected} />
    </QueryClientProvider>);
    return onRejected;
}
const flag = () => screen.getByLabelText("Прапор") as HTMLInputElement;
async function send(answer: string) {
    fireEvent.change(flag(), {target: {value: answer}});
    await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Надіслати"}));});
}

describe("a task of a closed stage", () => {
    it("keeps the text but takes no answers and opens no new hints", () => {
        renderModal({...base, Closed: true, Hints: [{ID: "h1", Level: "nudge", Cost: 10, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""}]}, stage);
        expect(screen.getByText(/Етап закрито: відповіді та підказки більше не приймаються/)).toBeTruthy();
        expect(screen.queryByLabelText("Прапор")).toBeNull();
        expect(screen.queryByRole("button", {name: "Відкрити"})).toBeNull();
        expect(screen.getAllByText("Закрито").length).toBeGreaterThan(0);
    });

    it("keeps an already unlocked hint text readable", () => {
        renderModal({...base, Closed: true, Hints: [{ID: "h1", Level: "nudge", Cost: 10, Unlocked: true, Content: "Відкрита раніше підказка", UnlockedAt: null, UnlockedByName: ""}]}, stage);
        expect(screen.getByText("Відкрита раніше підказка")).toBeTruthy();
    });
});

describe("a returnable stage after it ended", () => {
    const ended = {...stage, Returnable: true};

    it("says answers are checked but not rated, and a correct one is not announced as points", async () => {
        api.submit.mockResolvedValue({Correct: true, FirstSolve: false, Practice: true});
        const onRejected = renderModal(base, ended);
        expect(screen.getByText("Етап завершено. Відповіді перевіряються, але в рейтинг не йдуть.")).toBeTruthy();
        await send("ICE{ok}");
        expect(screen.getByText("Правильно. Розв’язано · не враховується в рейтингу")).toBeTruthy();
        expect(screen.queryByText(/^\+/)).toBeNull();
        expect(onRejected).toHaveBeenCalledTimes(1);
    });

    it("shows the practice solve with its own wording", () => {
        renderModal({...base, Practice: true}, ended);
        expect(screen.getAllByText("Розв’язано · не враховується в рейтингу").length).toBeGreaterThan(0);
        expect(screen.queryByLabelText("Прапор")).toBeNull();
    });
});

describe("a stage that closes while the modal is open", () => {
    it("shows why the answer was refused and refreshes the board", async () => {
        api.submit.mockRejectedValue(new ParticipantChallengeError(409, ApiErrorCode.StageClosed));
        // not closed as far as this task knows: the form is there and the server decides
        const onRejected = renderModal(base, {...stage, State: "closed", Returnable: false} as typeof stage, vi.fn());
        await send("ICE{x}");
        expect(screen.getByText("Етап закрито: відповіді більше не приймаються.")).toBeTruthy();
        expect(onRejected).toHaveBeenCalled();
    });
});

describe("the tile of a stage task", () => {
    const open = vi.fn();
    it("marks a closed task and a practice solve", () => {
        render(<ChallengeTile challenge={{...base, Closed: true}} onOpen={open} />);
        expect(screen.getByText("закрито")).toBeTruthy();
        cleanup();
        render(<ChallengeTile challenge={{...base, Practice: true}} onOpen={open} />);
        expect(screen.getAllByText("Розв’язано · не враховується в рейтингу").length).toBeGreaterThan(0);
        expect(screen.getByRole("button").getAttribute("aria-label")).toContain("Розв’язано · не враховується в рейтингу");
    });

    it("keeps the solved state of a closed task", () => {
        render(<ChallengeTile challenge={{...base, Closed: true, SolvedAt: "2026-10-01T09:00:00Z"}} onOpen={open} />);
        expect(screen.getByText("закрито")).toBeTruthy();
        expect(screen.getByRole("button").className).toContain("is-solved");
    });
});
