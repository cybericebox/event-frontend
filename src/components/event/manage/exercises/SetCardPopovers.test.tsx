// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen, within} from "@testing-library/react";
import type {EventBoardChallenge, TaskResources} from "@/api/manageChallenges";
import type {ManageScoring} from "@/api/manage";
import {SubtaskCount} from "./CatalogStats";
import {InfrastructureIcon} from "./InfrastructureIcon";
import {InfrastructurePopover, ScoringPopover, scoringBadge} from "./SetCardPopovers";

afterEach(cleanup);
const MIB = 1024 ** 2;
const amount = (cpu: number, mib: number, devices: number) => ({Blocks: devices * 4, CPUMillicores: cpu, MemoryBytes: mib * MIB, Devices: devices});
const resources: TaskResources = {Min: amount(15, 64, 1), Max: amount(500, 512, 3)} as TaskResources;
const scoring = (extra: Partial<ManageScoring> = {}): ManageScoring => ({Mode: 1, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 20, ForceEventScoring: false, StaticPoints: null, UpdatedAt: "", ...extra});
const task = (name: string, extra: Partial<EventBoardChallenge> = {}) => ({ID: name, Points: 300, ScoringOverride: null, Snapshot: {name, placeholders: []}, ...extra}) as unknown as EventBoardChallenge;

describe("the infrastructure mark", () => {
    it("is the catalog's three-node icon in every app", () => {
        const {container} = render(<InfrastructureIcon interactive={false} />);
        expect(container.querySelector("svg.lucide-network")).not.toBeNull();
        expect(container.querySelector("svg.lucide-server")).toBeNull();
    });

    it("opens the set's lab resources and the stand state", () => {
        render(<InfrastructurePopover resources={resources} stand="notReady" />);
        const trigger = screen.getByRole("button", {name: "Завдання з лабораторією: ресурси"});
        expect(trigger.querySelector("svg.lucide-network")).not.toBeNull();
        const panel = document.getElementById(trigger.getAttribute("popovertarget")!)!;
        expect(panel.getAttribute("role")).toBe("dialog");
        const text = panel.textContent!;
        expect(text).toContain("15 мілі-ядер–500 мілі-ядер");
        expect(text).toContain("64 МіБ–512 МіБ");
        expect(text).toContain("1–3");
        expect(text).toContain("Стенд не готовий");
    });
});

describe("the subtask count", () => {
    it.each([[1, "1 підзавдання"], [3, "3 підзавдання"], [5, "5 підзавдань"], [21, "21 підзавдання"]])("names the count (%i) and still opens the names", (count, label) => {
        render(<SubtaskCount count={count} names={["Перше"]} labelled />);
        const trigger = screen.getByRole("button", {name: `Підзавдання: ${count}. Показати назви`});
        expect(trigger.textContent).toBe(label);
        const panel = document.getElementById(trigger.getAttribute("popovertarget")!)!;
        expect(within(panel).getByText("Перше")).toBeTruthy();
    });
});

describe("the scoring badge", () => {
    it("reads «Як у заходу» and opens the event's dynamic range and decay", () => {
        const tasks = [task("A"), task("B")];
        expect(scoringBadge(tasks, scoring())).toBe("Як у заходу");
        render(<ScoringPopover tasks={tasks} scoring={scoring()} />);
        const trigger = screen.getByRole("button", {name: "Оцінювання: Як у заходу. Показати подробиці"});
        const panel = document.getElementById(trigger.getAttribute("popovertarget")!)!;
        expect(panel.textContent).toContain("Динамічне · 500 → 100");
        expect(panel.textContent).toContain("За кількістю розвʼязань");
    });

    it("lists the tasks' own scoring, static with its points", () => {
        const tasks = [task("A", {ScoringOverride: {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0}, Points: 250}), task("B", {ScoringOverride: {Mode: 3, MinPoints: 50, MaxPoints: 400, FloorAtPercent: 0}})];
        expect(scoringBadge(tasks, scoring())).toBe("Власне оцінювання");
        render(<ScoringPopover tasks={tasks} scoring={scoring({Mode: 0, StaticPoints: 200})} />);
        const panel = document.getElementById(screen.getByRole("button").getAttribute("popovertarget")!)!;
        expect(panel.textContent).toContain("Статичне · 200 балів");
        expect(panel.textContent).toContain("«A»: Статичне · 250 балів");
        expect(panel.textContent).toContain("«B»: Динамічне · 400 → 50");
        expect(panel.textContent).toContain("За часом розвʼязання");
    });

    it("says the event's scoring is forced, whatever the tasks set", () => {
        const tasks = [task("A", {ScoringOverride: {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0}})];
        expect(scoringBadge(tasks, scoring({ForceEventScoring: true}))).toBe("Як у заходу");
        render(<ScoringPopover tasks={tasks} scoring={scoring({ForceEventScoring: true})} />);
        const panel = document.getElementById(screen.getByRole("button").getAttribute("popovertarget")!)!;
        expect(panel.textContent).toContain("Для всіх завдань діє оцінювання заходу");
        expect(panel.textContent).not.toContain("«A»");
    });
});
