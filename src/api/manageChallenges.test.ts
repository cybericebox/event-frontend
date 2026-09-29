import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ApiErrorCode} from "./apiErrors";

type Api = typeof import("./manageChallenges");
const eventID = "01900000-0000-7000-8000-000000000001";
let api: Api;

// Every test gets a fresh mock state.
beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "1");
    vi.resetModules();
    api = await import("./manageChallenges");
});
afterEach(() => vi.unstubAllEnvs());

describe("event challenge scoring", () => {
    it("saves a local algorithm and can return to the event profile", async () => {
        const [attachment] = await api.getEventExerciseAttachments(eventID);
        const [challenge] = await api.getEventBoardChallenges(eventID, attachment.ID);
        const override = {Mode: 1 as const, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50};

        await api.updateEventChallengeScoring(eventID, attachment.ID, challenge.ID, override);
        expect((await api.getEventBoardChallenges(eventID, attachment.ID))[0].ScoringOverride).toEqual(override);

        await api.updateEventChallengeScoring(eventID, attachment.ID, challenge.ID, null);
        expect((await api.getEventBoardChallenges(eventID, attachment.ID))[0].ScoringOverride).toBeNull();
    });
});

describe("catalog preview", () => {
    it("lists tasks of the requested variant without exposing answer data", async () => {
        const [choice] = await api.getEventExerciseAttachments(eventID);
        const preview = await api.getPublishedExercisePreview(eventID, choice.ExerciseVersionID);
        expect(preview.Tasks.map(task => task.Name)).toEqual(["Перший крок", "Фінальне завдання"]);
        expect(preview.Tasks.map(task => task.HintCount)).toEqual([2, 1]);
        expect(JSON.stringify(preview)).not.toContain("Flag");
        expect((await api.getPublishedExercisePreview(eventID, choice.ExerciseVersionID, 1)).Variant).toBe(1);
    });

    it("filters by infrastructure, lists own exercises first and marks attached ones", async () => {
        const all = await api.getPublishedExerciseChoices(eventID, "");
        expect(all[0].Scope).toBe("event");
        expect(all.find(item => item.Name === "Основи кібербезпеки")?.Attached).toBe(true);
        // Attached through the event's copy.
        expect(all.find(item => item.Name === "Мережевий аналіз" && item.Scope === "catalog")?.Attached).toBe(true);
        expect((await api.getPublishedExerciseChoices(eventID, "", "yes")).every(item => item.Infrastructure)).toBe(true);
        expect((await api.getPublishedExerciseChoices(eventID, "", "no")).every(item => !item.Infrastructure)).toBe(true);
    });
});

describe("attachments", () => {
    it("parses catalog versions, forks and detached sets", async () => {
        const attachments = await api.getEventExerciseAttachments(eventID);
        const [catalog, fork, own, detached] = attachments;
        expect(catalog).toMatchObject({Scope: "catalog", VersionNumber: 2, LatestVersionNumber: 3, UpdateAvailable: true, Fork: null});
        expect(fork.Fork).toMatchObject({SourceVersionNumber: 1, SourceLatestVersionNumber: 2, SourceUpdateAvailable: true});
        expect(own).toMatchObject({Scope: "event", Fork: null});
        expect(detached.Status).toBe(2);
    });

    it("accepts a legacy attachment without the W4 fields", () => {
        const legacy = api.EventExerciseAttachmentSchema.parse({
            ID: eventID, ExerciseID: eventID, ExerciseName: "Набір", ExerciseVersionID: eventID, VariantMode: 0, FixedVariantIndex: null,
            Revision: 3, Status: 0, ReplacesID: null, SupersededAt: null, CreatedAt: "2026-09-26T00:00:00Z",
        });
        expect(legacy).toMatchObject({Scope: "catalog", VersionNumber: 0, UpdateAvailable: false, Fork: null, DetachedAt: null});
    });

    it("updates to the latest version and keeps event settings", async () => {
        const [attachment] = await api.getEventExerciseAttachments(eventID);
        const before = await api.getEventBoardChallenges(eventID, attachment.ID);
        const updated = await api.updateEventExercise(eventID, attachment.ID);
        expect(updated).toMatchObject({VersionNumber: 3, UpdateAvailable: false});
        expect(await api.getEventBoardChallenges(eventID, attachment.ID)).toEqual(before);
    });

    it("forks a catalog set and reverts it back", async () => {
        const [attachment] = await api.getEventExerciseAttachments(eventID);
        const fork = await api.forkEventExercise(eventID, attachment.ID);
        expect(fork.Scope).toBe("event");
        expect(fork.Fork?.SourceExerciseID).toBe(attachment.ExerciseID);
        expect(fork.ExerciseID).not.toBe(attachment.ExerciseID);
        const reverted = await api.revertEventExercise(eventID, attachment.ID);
        expect(reverted).toMatchObject({Scope: "catalog", ExerciseID: attachment.ExerciseID, Fork: null});
    });

    it("asks to confirm detaching a set with attempts, then keeps it as detached", async () => {
        const [attachment] = await api.getEventExerciseAttachments(eventID);
        await expect(api.detachEventExercise(eventID, attachment.ID)).rejects.toMatchObject({status: 409, code: ApiErrorCode.ExerciseDetachNeedsConfirm});
        await api.detachEventExercise(eventID, attachment.ID, true);
        expect((await api.getEventExerciseAttachments(eventID)).find(item => item.ID === attachment.ID)?.Status).toBe(2);
    });

    it("detaches a set without attempts at once", async () => {
        const own = (await api.getEventExerciseAttachments(eventID))[2];
        await api.detachEventExercise(eventID, own.ID);
        expect((await api.getEventExerciseAttachments(eventID)).some(item => item.ID === own.ID)).toBe(false);
    });
});

describe("hints", () => {
    it("overrides a hint cost and resets it with null", async () => {
        const [attachment] = await api.getEventExerciseAttachments(eventID);
        const [challenge] = await api.getEventBoardChallenges(eventID, attachment.ID);
        const [free, paid] = challenge.Hints;
        const changed = await api.updateEventChallengeHintCosts(eventID, attachment.ID, challenge.ID, [{HintID: free.ID, Cost: 15}, {HintID: paid.ID, Cost: null}]);
        expect(changed.Hints[0]).toMatchObject({Cost: 15, DefaultCost: 0, Overridden: true});
        expect(changed.Hints[1]).toMatchObject({Cost: paid.DefaultCost, Overridden: false});
        await expect(api.updateEventChallengeHintCosts(eventID, attachment.ID, challenge.ID, [{HintID: free.ID, Cost: -1}])).rejects.toMatchObject({status: 400, code: ApiErrorCode.HintCostsInvalid});
    });

    it("lists hint unlocks newest first", async () => {
        const unlocks = await api.getHintUnlocks(eventID);
        expect(unlocks.length).toBeGreaterThan(0);
        expect(unlocks.map(item => Date.parse(item.UnlockedAt))).toEqual([...unlocks.map(item => Date.parse(item.UnlockedAt))].sort((a, b) => b - a));
        expect(api.HintUnlockSchema.parse(unlocks[0]).HintIndex).toBeTypeOf("number");
    });
});
