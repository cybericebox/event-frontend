// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen, within} from "@testing-library/react";
import type {ManageScoring} from "@/api/manage";
import type {EventBoardChallenge, EventExerciseAttachment} from "@/api/manageChallenges";
import {t, tPlural} from "@/i18n/t";
import {TaskStatsSummary} from "./TaskStatsSummary";

afterEach(cleanup);

const scoring: ManageScoring = {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0, ForceEventScoring: false, StaticPoints: null, UpdatedAt: ""};
const challenge = (id: string, patch: Partial<EventBoardChallenge> = {}) => ({
    ID: id, TaskID: id, GroupID: null, PrerequisiteIDs: [], Order: 0, Points: 100, EffectivePoints: 100, ScoringOverride: null,
    HintsEnabled: true, Published: true, MaxFlagAttempts: null, BoardOrder: null, Snapshot: {name: id, difficulty: "easy", placeholders: []}, Hints: [], ...patch,
}) as EventBoardChallenge;
const attachment = (patch: Partial<EventExerciseAttachment> = {}) => ({ID: "a", Infrastructure: false, StageID: null, Tags: ["web"], ...patch}) as EventExerciseAttachment;

describe("TaskStatsSummary", () => {
    it("renders nothing without sets", () => {
        const {container} = render(<TaskStatsSummary sets={[]} scoring={scoring} stages={[]} groups={[]} />);
        expect(container.innerHTML).toBe("");
    });

    it("shows the tiles and the chip rows; the infrastructure tile only when some task has it", () => {
        const sets = [{attachment: attachment(), challenges: [challenge("c1"), challenge("c2", {Published: false, Snapshot: {name: "c2", placeholders: []}})]}];
        const {rerender} = render(<TaskStatsSummary sets={sets} scoring={scoring} stages={[]} groups={[]} />);
        const grid = screen.getByRole("region", {name: t("manage.exercises.stats.label")});
        expect(within(grid).getByText(t("manage.exercises.stats.tasks"))).toBeTruthy();
        expect(within(grid).getByText(t("manage.exercises.stats.tasksNote", {sets: tPlural("manage.exercises.stats.sets", 1), published: 1, hidden: 1}))).toBeTruthy();
        expect(within(grid).getByText(t("manage.exercises.stats.maxPointsNote", {points: 100}))).toBeTruthy();
        expect(within(grid).queryByText(t("manage.exercises.stats.infrastructure"))).toBeNull();
        const difficulty = screen.getByRole("group", {name: t("manage.exercises.stats.byDifficulty")});
        expect(within(difficulty).getByText(t("manage.exercises.stats.chip", {name: t("manage.exercises.difficulty.easy"), count: 1}))).toBeTruthy();
        expect(within(difficulty).getByText(t("manage.exercises.stats.chip", {name: t("manage.exercises.stats.difficultyNone"), count: 1}))).toBeTruthy();
        const categories = screen.getByRole("group", {name: t("manage.exercises.stats.byCategory")});
        expect(within(categories).getByText(t("manage.exercises.stats.chip", {name: "web", count: 2}))).toBeTruthy();
        // Stages and groups only when the event has them.
        expect(screen.queryByRole("group", {name: t("manage.exercises.stats.byStage")})).toBeNull();
        expect(screen.queryByRole("group", {name: t("manage.exercises.stats.byGroup")})).toBeNull();

        rerender(<TaskStatsSummary sets={[{attachment: attachment({Infrastructure: true, StageID: "s1"}), challenges: [challenge("c1", {GroupID: "g1"})]}]} scoring={scoring}
            stages={[{ID: "s1", Name: "Перший етап"} as never]} groups={[{ID: "g1", Name: "Веб", Order: 0, CreatedAt: ""}]} />);
        expect(screen.getByText(t("manage.exercises.stats.infrastructure"))).toBeTruthy();
        expect(within(screen.getByRole("group", {name: t("manage.exercises.stats.byStage")})).getByText(t("manage.exercises.stats.chip", {name: "Перший етап", count: 1}))).toBeTruthy();
        expect(within(screen.getByRole("group", {name: t("manage.exercises.stats.byGroup")})).getByText(t("manage.exercises.stats.chip", {name: "Веб", count: 1}))).toBeTruthy();
    });
});
