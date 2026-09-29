// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import type {OwnChallenge} from "@/api/participantChallenges";

const unlock = vi.fn();
vi.mock("@/api/participantChallenges", async importOriginal => ({...await importOriginal<typeof import("@/api/participantChallenges")>(), unlockChallengeHint: (...args: unknown[]) => unlock(...args)}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}})}));

const {HintsBlock} = await import("./ChallengeModal");

// jsdom has no top-layer dialog.
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); unlock.mockReset(); });

const challenge = {
    EventChallengeID: "c1", HintCostTotal: 0,
    Hints: [
        {ID: "h1", Level: "nudge", Cost: 0, Unlocked: true, Content: "Дивіться у заголовки", UnlockedAt: "2026-09-29T09:12:00Z", UnlockedByName: "Андрій"},
        {ID: "h2", Level: "steps", Cost: 50, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""},
        {ID: "h3", Level: "direction", Cost: 0, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""},
    ],
} as unknown as OwnChallenge;

describe("HintsBlock", () => {
    it("shows unlocked texts with who opened them", () => {
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="reward" onUnlocked={() => {}} />);
        expect(screen.getByText("Дивіться у заголовки")).toBeTruthy();
        expect(screen.getByText(/Відкрито: Андрій/)).toBeTruthy();
        expect(screen.getByText("· −50 балів")).toBeTruthy();
        expect(screen.getByText(/^Підказка 2/)).toBeTruthy();
        expect(screen.queryByText(/Покроково/)).toBeNull();
        expect(screen.getAllByRole("button", {name: "Відкрити підказку"})).toHaveLength(2);
    });

    it("confirms a paid hint with the mode effect before unlocking", async () => {
        unlock.mockResolvedValue({});
        const onUnlocked = vi.fn();
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="balance" onUnlocked={onUnlocked} />);
        fireEvent.click(screen.getAllByRole("button", {name: "Відкрити підказку"})[0]);
        expect(unlock).not.toHaveBeenCalled();
        expect(screen.getByText("Відкриття одразу спише 50 балів з рахунку команди.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Відкрити"}));
        await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
        expect(unlock).toHaveBeenCalledWith("e", "c1", "h2");
    });

    it("opens a free hint at once", async () => {
        unlock.mockResolvedValue({});
        const onUnlocked = vi.fn();
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="reward" onUnlocked={onUnlocked} />);
        fireEvent.click(screen.getAllByRole("button", {name: "Відкрити підказку"})[1]);
        await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
        expect(unlock).toHaveBeenCalledWith("e", "c1", "h3");
    });

    it("shows the error when the unlock fails", async () => {
        const {ParticipantChallengeError} = await import("@/api/participantChallenges");
        unlock.mockRejectedValue(new ParticipantChallengeError(409, 1933));
        render(<HintsBlock challenge={challenge} eventID="e" moderators={false} chargeMode="reward" onUnlocked={() => {}} />);
        fireEvent.click(screen.getAllByRole("button", {name: "Відкрити підказку"})[1]);
        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(screen.getByText("Підказки для цього завдання вимкнено")).toBeTruthy();
    });

    it("renders a rich-text hint formatted", () => {
        const content = JSON.stringify({root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: "curl -I", format: 16}]}]}});
        const rich = {...challenge, Hints: [{...challenge.Hints[0], Content: content}]} as OwnChallenge;
        const {container} = render(<HintsBlock challenge={rich} eventID="e" moderators={false} chargeMode="reward" onUnlocked={() => {}} />);
        expect(container.querySelector("code")?.textContent).toBe("curl -I");
        expect(screen.queryByText(content)).toBeNull();
    });

    it("never offers unlocking on the moderators board", () => {
        render(<HintsBlock challenge={challenge} eventID="e" moderators chargeMode="reward" onUnlocked={() => {}} />);
        expect(screen.queryByRole("button", {name: "Відкрити підказку"})).toBeNull();
        expect(screen.getByText(/Підказка 2 · Покроково/)).toBeTruthy();
    });
});
