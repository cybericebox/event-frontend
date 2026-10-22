// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {EventBoardChallenge, EventChallengeGroup, EventExerciseAttachment} from "@/api/manageChallenges";
import type {ManageConfig} from "@/api/manage";
import {t} from "@/i18n/t";
import type {BoardSet} from "./challengeOrder";
import {ChallengeGroupsManager} from "./ChallengeGroupsManager";

vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1"}, canManage: true})}));

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

const attachment: EventExerciseAttachment = {
    ID: "a1", ExerciseID: "x1", ExerciseName: "Веб", ExerciseVersionID: "v1", VariantMode: 0, FixedVariantIndex: null,
    Revision: 0, Status: 0, ReplacesID: null, SupersededAt: null, DetachedAt: null, CreatedAt: "2026-10-01T00:00:00Z",
    StageID: null, Scope: "catalog", Tags: [], VersionNumber: 1, LatestVersionID: null, LatestVersionNumber: 1, UpdateAvailable: false,
    Fork: null, Infrastructure: false, VariantCount: 1, ChallengeCount: 0, PublishedCount: 0, HasAttempts: false,
    ResourceHeavy: false, Resources: null, NoAgentFits: false, FlagsRepeat: null, AvgDifficulty: null, TaskCount: null, TaskNames: [],
};
const config: ManageConfig = {
    EventID: "e1", LabPolicy: null, Participation: 0, Registration: 0, ScoreboardVisibility: 0, ParticipantsVisibility: 0,
    PreviewDescription: "", PreviewPicture: "", MaxTeamSize: 3, MinTeamSize: null, MaxTeams: null, InfrastructureAllowed: true,
    AllowPseudonyms: false, ShowDifficulty: true, HintsDisabled: false, HintChargeMode: "reward", MaxFlagAttempts: null,
    TaskRevealMode: "all_ready", ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 10, FinishCountdownMode: "before_end",
    Theme: {Brand: "#112233", Accent: "", AccentLight: "#112233", AccentDark: "#112233", AccentLive: "#112233", Version: 1}, UpdatedAt: "",
};
const task = (id: string, groupID: string | null = null): EventBoardChallenge => ({
    ID: id, TaskID: id, GroupID: groupID, PrerequisiteIDs: [], Order: 0, Points: 100, EffectivePoints: 100, ScoringOverride: null,
    HintsEnabled: true, Published: true, MaxFlagAttempts: null, BoardOrder: null, Snapshot: {name: id, placeholders: []}, Hints: [],
});

function renderGroups(groups: EventChallengeGroup[] = [], sets: BoardSet[] = []) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
    client.setQueryData(["event-exercise-attachments", "e1"], sets.map(set => set.attachment));
    client.setQueryData(["event-challenge-groups", "e1"], groups);
    client.setQueryData(["event-exercise-boards", "e1", sets.map(set => `${set.attachment.ID}:${set.attachment.Revision}`).join("|")], sets);
    client.setQueryData(["event-management-config", "e1"], config);
    render(<QueryClientProvider client={client}><ChallengeGroupsManager /></QueryClientProvider>);
    return screen.getByRole("region", {name: "Групи"});
}

describe("ChallengeGroupsManager group sidebar", () => {
    it.each([{label: "no attached sets", sets: []}, {label: "an empty attached set", sets: [{attachment, challenges: []}]}])("shows only the shared empty state and add action with $label", ({sets}) => {
        const left = renderGroups([], sets);
        expect(left.querySelectorAll("[data-empty-state]")).toHaveLength(1);
        expect(within(left).getByText(t("manage.exercises.groups.empty"))).toBeTruthy();
        expect(within(left).getByRole("button", {name: "Додати групу"})).toBeTruthy();
        expect(within(left).queryByRole("button", {name: /^Без групи/})).toBeNull();
    });

    it.each([null, "deleted-group"])("shows actual ungrouped tasks without a contradictory empty state (GroupID: %s)", groupID => {
        const left = renderGroups([], [{attachment, challenges: [task("Перше підзавдання", groupID)]}]);
        expect(left.querySelector("[data-empty-state]")).toBeNull();
        expect(within(left).queryByText(t("manage.exercises.groups.empty"))).toBeNull();
        expect(within(left).getByRole("button", {name: /^Без групи\s*1 підзавдання$/}).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByText("Перше підзавдання")).toBeTruthy();
    });

    it("keeps an empty ungrouped destination beside named groups and can navigate back to their tasks", async () => {
        const groups = [{ID: "g1", Name: "Крипто", Order: 0, CreatedAt: ""}];
        const left = renderGroups(groups, [{attachment, challenges: [task("Перше підзавдання", "g1"), {...task("Друге підзавдання", "g1"), Order: 1}]}]);
        expect(left.querySelector("[data-empty-state]")).toBeNull();
        const ungrouped = within(left).getByRole("button", {name: /^Без групи\s*0 підзавдань$/});
        fireEvent.click(ungrouped);
        expect(ungrouped.getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByText("У цій групі немає підзавдань.")).toBeTruthy();
        expect(screen.queryByText("Перше підзавдання")).toBeNull();

        fireEvent.click(within(left).getByRole("button", {name: /^Крипто\s*2 підзавдання$/}));
        expect(ungrouped.getAttribute("aria-pressed")).toBe("false");
        expect(screen.getByText("Перше підзавдання")).toBeTruthy();
        expect((screen.getByRole("button", {name: "Опустити Перше підзавдання"}) as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByRole("button", {name: "Підняти Друге підзавдання"}) as HTMLButtonElement).disabled).toBe(false);
        const actions = screen.getByRole("group", {name: "Дії з підзавданням Перше підзавдання"});
        fireEvent.click(within(actions).getByRole("button", {name: "Перемістити до групи…"}));
        expect(screen.getByRole("dialog", {name: "Перемістити до групи"})).toBeTruthy();
        const target = screen.getByRole("button", {name: "Група"});
        fireEvent.pointerDown(target, {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Без групи"}));
        expect(target.textContent).toBe("Без групи");
        expect((screen.getByRole("button", {name: "Перемістити"}) as HTMLButtonElement).disabled).toBe(false);
    });
});

describe("ChallengeGroupsManager task rows", () => {
    it("show the difficulty and the points of each task", () => {
        const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
        const sets = [{attachment, challenges: [{...task("Рахунок директора"), EffectivePoints: 22, Snapshot: {name: "Рахунок директора", difficulty: "medium", placeholders: []}}]}];
        client.setQueryData(["event-exercise-attachments", "e1"], sets.map(set => set.attachment));
        client.setQueryData(["event-challenge-groups", "e1"], []);
        client.setQueryData(["event-exercise-boards", "e1", sets.map(set => `${set.attachment.ID}:${set.attachment.Revision}`).join("|")], sets);
        client.setQueryData(["event-management-config", "e1"], config);
        client.setQueryData(["event-management-scoring", "e1"], {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0, ForceEventScoring: false, StaticPoints: null, UpdatedAt: ""});
        render(<QueryClientProvider client={client}><ChallengeGroupsManager /></QueryClientProvider>);
        const row = screen.getByText("Рахунок директора").closest(".event-group-order__task")!;
        expect(row.querySelector(".event-group-order__meta")?.textContent).toBe("Середня22 бали");
    });
});
