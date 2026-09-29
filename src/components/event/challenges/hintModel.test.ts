import {afterEach, describe, expect, it, vi} from "vitest";
import {ApiErrorCode} from "@/api/apiErrors";
import {ParticipantChallengeError} from "@/api/participantChallenges";
import {hintConfirmText, hintCostLabel, hintModeNote, hintNeedsConfirm, hintUnlockError} from "./hintModel";

vi.mock("@/utils/origins", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));

afterEach(() => vi.unstubAllGlobals());

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

describe("hint unlock API", () => {
    it("posts the unlock and returns the revealed hint", async () => {
        const fetchStub = vi.fn().mockResolvedValue(new Response(JSON.stringify({Data: {
            ID: "h1", Cost: 50, Unlocked: true, Content: "Подивіться на robots.txt.", UnlockedAt: "2026-09-29T10:00:00Z", UnlockedByName: "Олена Коваль",
        }}), {status: 200}));
        vi.stubGlobal("fetch", fetchStub);
        const api = await import("@/api/participantChallenges");
        const unlocked = await api.unlockChallengeHint("01900000-0000-7000-8000-000000000001", "c1", "h1");
        const [url, init] = fetchStub.mock.calls[0];
        expect(url).toBe("https://api.example.org/api/events/01900000-0000-7000-8000-000000000001/teams/challenges/c1/hints/h1/unlock");
        expect(init).toMatchObject({method: "POST", credentials: "include"});
        expect(unlocked).toEqual({ID: "h1", Cost: 50, Unlocked: true, Content: "Подивіться на robots.txt.", UnlockedAt: "2026-09-29T10:00:00Z", UnlockedByName: "Олена Коваль"});
    });

    it("maps a refused unlock to a participant error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({Status: {Code: ApiErrorCode.HintsDisabled}}), {status: 409})));
        const api = await import("@/api/participantChallenges");
        await expect(api.unlockChallengeHint("01900000-0000-7000-8000-000000000001", "c1", "h1")).rejects.toMatchObject({status: 409});
    });

    it("parses a board hint with nulls from the API", () => {
        return import("@/api/participantChallenges").then(api => {
            expect(api.hintSchema.parse({ID: "h", Cost: 5, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: null}))
                .toEqual({ID: "h", Cost: 5, Unlocked: false, Content: null, UnlockedAt: null, UnlockedByName: ""});
        });
    });
});
