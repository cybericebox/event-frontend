import {afterEach, describe, expect, it, vi} from "vitest";
import {ApiErrorCode} from "@/api/apiErrors";
import {ParticipantChallengeError} from "@/api/participantChallenges";
import {hintConfirmText, hintCostLabel, hintModeNote, hintNeedsConfirm, hintUnlockError} from "./hintModel";

afterEach(() => vi.unstubAllEnvs());

describe("hint copy", () => {
    it("labels the cost or a free hint", () => {
        expect(hintCostLabel(30)).toBe("−30 балів");
        expect(hintCostLabel(1)).toBe("−1 бал");
        expect(hintCostLabel(0)).toBe("безкоштовно");
    });

    it("states what the unlock does in each charge mode", () => {
        expect(hintConfirmText("reward", 50)).toBe("Відкриття зменшить винагороду за це завдання на 50 балів.");
        expect(hintConfirmText("balance", 22)).toBe("Відкриття одразу спише 22 бали з рахунку команди.");
        expect(hintModeNote("reward")).toContain("знижують винагороду");
        expect(hintModeNote("balance")).toContain("з балансу одразу");
    });

    it("confirms only locked paid hints", () => {
        expect(hintNeedsConfirm({Cost: 10, Unlocked: false})).toBe(true);
        expect(hintNeedsConfirm({Cost: 0, Unlocked: false})).toBe(false);
        expect(hintNeedsConfirm({Cost: 10, Unlocked: true})).toBe(false);
    });

    it("maps unlock errors", () => {
        expect(hintUnlockError(new ParticipantChallengeError(409, ApiErrorCode.HintsDisabled))).toBe("Підказки для цього завдання вимкнено");
        expect(hintUnlockError(new ParticipantChallengeError(409, ApiErrorCode.ChallengePrerequisites))).toBe("Спершу розвʼяжіть попередні завдання");
        expect(hintUnlockError(new ParticipantChallengeError(404, ApiErrorCode.HintNotFound))).toContain("не знайдено");
        expect(hintUnlockError(new ParticipantChallengeError(409))).toBe("Підказки зараз недоступні");
        expect(hintUnlockError(new Error("x"))).toContain("Не вдалося");
    });
});

describe("hint unlock (mock API)", () => {
    it("reveals the text, charges once and stays idempotent", async () => {
        vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "1");
        vi.resetModules();
        const api = await import("@/api/participantChallenges");
        const eventID = "01900000-0000-7000-8000-000000000001";
        const challenge = (await api.getOwnChallenges(eventID)).find(item => item.Hints.some(hint => !hint.Unlocked && hint.Cost > 0))!;
        const hint = challenge.Hints.find(item => !item.Unlocked && item.Cost > 0)!;
        expect(hint.Content).toBeNull();
        const unlocked = await api.unlockChallengeHint(eventID, challenge.EventChallengeID, hint.ID);
        expect(unlocked).toMatchObject({Unlocked: true, Cost: hint.Cost});
        expect(unlocked.Content).toBeTruthy();
        expect(unlocked.UnlockedByName).toBeTruthy();
        await api.unlockChallengeHint(eventID, challenge.EventChallengeID, hint.ID);
        const after = (await api.getOwnChallenges(eventID)).find(item => item.EventChallengeID === challenge.EventChallengeID)!;
        expect(after.HintCostTotal).toBe(challenge.HintCostTotal + hint.Cost);
    });

    it("parses a board hint with nulls from the API", () => {
        return import("@/api/participantChallenges").then(api => {
            expect(api.hintSchema.parse({ID: "h", Cost: 5, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: null}))
                .toEqual({ID: "h", Cost: 5, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""});
        });
    });
});
