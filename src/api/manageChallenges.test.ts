import {afterEach, describe, expect, it, vi} from "vitest";
import {getEventBoardChallenges, getEventExerciseAttachments, getPublishedExercisePreview, updateEventChallengeScoring} from "./manageChallenges";

afterEach(() => vi.unstubAllEnvs());

describe("event challenge scoring", () => {
    it("saves a local algorithm and can return to the event profile", async () => {
        vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "1");
        const eventID = "01900000-0000-7000-8000-000000000001";
        const [attachment] = await getEventExerciseAttachments(eventID);
        const [challenge] = await getEventBoardChallenges(eventID, attachment.ID);
        const override = {Mode: 1 as const, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50};

        await updateEventChallengeScoring(eventID, attachment.ID, challenge.ID, override);
        expect((await getEventBoardChallenges(eventID, attachment.ID))[0].ScoringOverride).toEqual(override);

        await updateEventChallengeScoring(eventID, attachment.ID, challenge.ID, null);
        expect((await getEventBoardChallenges(eventID, attachment.ID))[0].ScoringOverride).toBeNull();
    });
});

describe("catalog preview", () => {
    it("lists tasks without exposing answer data", async () => {
        vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "1");
        const eventID = "01900000-0000-7000-8000-000000000001";
        const [choice] = await getEventExerciseAttachments(eventID);
        const preview = await getPublishedExercisePreview(eventID, choice.ExerciseVersionID);
        expect(preview.Tasks.map(task => task.Name)).toEqual(["Перший крок", "Фінальне завдання"]);
        expect(JSON.stringify(preview)).not.toContain("Flag");
    });
});
