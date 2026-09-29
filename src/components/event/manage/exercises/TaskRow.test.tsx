// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {EventBoardChallenge, EventExerciseAttachment} from "@/api/manageChallenges";
import type {ManageLifecycle, ManageScoring} from "@/api/manage";
import {TaskRow} from "./TaskRow";

afterEach(cleanup);

const challenge = {
    ID: "01900000-0000-7000-8000-0000000000c1", TaskID: "01900000-0000-7000-8000-0000000000t1", GroupID: null, PrerequisiteIDs: [],
    Order: 0, BoardOrder: null, Points: 150, ScoringOverride: null, HintsEnabled: true, Published: true,
    Snapshot: {name: "SQL injection", description: {root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: "Знайдіть прапор у формі входу"}]}]}}},
    Hints: [{ID: "01900000-0000-7000-8000-0000000000h1", Text: "Подивіться на запит", Level: "nudge", Cost: 20, Overridden: true}],
} as EventBoardChallenge;
const attachment = {ID: "01900000-0000-7000-8000-0000000000a1", Infrastructure: false} as EventExerciseAttachment;
const scoring = {Mode: 0, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50, ForceEventScoring: false, StaticPoints: 100, UpdatedAt: ""} as ManageScoring;
const lifecycle = {JoinPolicy: 0, FinishAt: null} as unknown as ManageLifecycle;

function renderRow(patch: Partial<ManageScoring> = {}) {
    render(<ul><TaskRow eventID="e" attachment={attachment} challenge={challenge} scoring={{...scoring, ...patch}} lifecycle={lifecycle} stand="notReady"
        canManage editURL={null} onSaved={vi.fn(async () => undefined)} onRemove={vi.fn()} /></ul>);
}

describe("TaskRow", () => {
    it("shows name, first description line and badges without buttons while collapsed", () => {
        renderRow();
        const row = screen.getByRole("button", {expanded: false});
        expect(row.textContent).toContain("SQL injection");
        expect(row.textContent).toContain("Знайдіть прапор у формі входу");
        expect(row.textContent).toContain("На дошці");
        expect(row.textContent).toContain("Підказки");
        expect(row.textContent).toContain("Стенд не готовий");
        expect(screen.queryByRole("button", {name: "Прибрати із заходу"})).toBeNull();
    });

    it("expands into scoring, hints and board sections with the row actions", () => {
        renderRow();
        fireEvent.click(screen.getByRole("button", {expanded: false}));
        expect(screen.getAllByRole("heading", {level: 4}).map(heading => heading.textContent)).toEqual(["Оцінювання", "Підказки", "Дошка"]);
        expect(screen.getByText("Статичне · 100 балів")).toBeTruthy();
        expect(screen.getByText("Підказка 1")).toBeTruthy();
        expect((screen.getByLabelText(/Вартість підказки 1/) as HTMLInputElement).value).toBe("20");
        expect(screen.getByRole("switch", {name: "Показувати на дошці"})).toBeTruthy();
        expect(screen.getByRole("button", {name: "Прибрати із заходу"})).toBeTruthy();
    });

    it("locks task scoring when the event scoring applies to all tasks", () => {
        renderRow({ForceEventScoring: true});
        fireEvent.click(screen.getByRole("button", {expanded: false}));
        expect(screen.getByText(/Діє оцінювання заходу/)).toBeTruthy();
        expect((screen.getByRole("button", {name: "Оцінювання завдання SQL injection"}) as HTMLButtonElement).disabled).toBe(true);
    });
});
